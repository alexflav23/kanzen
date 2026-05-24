package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{AssetRepo, RestructureRepo, RestructureService}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F24 — legacy onboarding (relaxed-validation create) + non-destructive, auditable, reversible
  * restructure (merge / split). Originals are superseded + linked, never deleted; cost basis is
  * reallocated explicitly and the before/after is recorded so every reshape stays explainable. */
object Restructure {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class LegacyCreateReq(title: String, categoryId: Option[UUID], costMinor: Option[Long],
                                   currency: Option[String], acquisitionDate: Option[LocalDate], uncertaintyNote: Option[String])
  final case class Created(id: UUID)
  final case class MergeReq(survivorId: UUID, mergedId: UUID)
  final case class MergeResult(opId: UUID, survivorId: UUID, mergedId: UUID, combinedCostMinor: Long)
  final case class SplitReq(assetId: UUID, intoCount: Int)
  final case class SplitResult(opId: UUID, parentId: UUID, childIds: List[UUID], allocatedMinor: List[Long])
  final case class ReverseResult(opId: UUID, reverseOpId: UUID, kind: String)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to assets"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private def conflict(m: String): (StatusCode, ApiError) = (StatusCode.Conflict, ApiError(409, "conflict", m))

  private def canWrite(p: Principal): ConnectionIO[Boolean] = Authz.authorizer(p.role).map(_.can(Level.Write, "asset"))

  /** AC1 — legacy create: approximate fields + uncertainty note, no receipt; valid but flaggable. */
  def legacyCreate(xa: Transactor[IO], p: Principal, r: LegacyCreateReq): IO[Out[Created]] =
    if (r.title.trim.isEmpty) IO.pure(Left(badReq("title required")))
    else canWrite(p).flatMap {
      case false => (Left(forbidden): Out[Created]).pure[ConnectionIO]
      case true  => RestructureRepo.createBare(p.userId, r.title, r.categoryId, None, r.costMinor, r.currency, r.acquisitionDate, r.uncertaintyNote).map(id => Right(Created(id)): Out[Created])
    }.transact(xa)

  /** AC3 — merge `merged` into `survivor`: lineage preserved, cost basis summed, audited, reversible. */
  def merge(xa: Transactor[IO], p: Principal, r: MergeReq): IO[Out[MergeResult]] = {
    if (r.survivorId == r.mergedId) IO.pure(Left(badReq("cannot merge an asset into itself")))
    else {
      val tx = for {
        w  <- canWrite(p)
        sv <- RestructureRepo.assetCost(r.survivorId).map(_.getOrElse(0L))
        mc <- RestructureRepo.assetCost(r.mergedId).map(_.getOrElse(0L))
        sExists <- AssetRepo.exists(r.survivorId)
        mExists <- AssetRepo.exists(r.mergedId)
        already <- RestructureRepo.isSuperseded(r.mergedId)
        res <-
          if (!w) (Left(forbidden): Out[MergeResult]).pure[ConnectionIO]
          else if (!sExists || !mExists) (Left(notFound): Out[MergeResult]).pure[ConnectionIO]
          else if (already) (Left(conflict("merged asset is already superseded")): Out[MergeResult]).pure[ConnectionIO]
          else {
            val combined = sv + mc
            val before = Json.obj("survivor" -> Json.obj("id" -> r.survivorId.asJson, "costMinor" -> sv.asJson),
                                  "merged"   -> Json.obj("id" -> r.mergedId.asJson, "costMinor" -> mc.asJson))
            val after  = Json.obj("survivor" -> Json.obj("id" -> r.survivorId.asJson, "costMinor" -> combined.asJson))
            for {
              _   <- RestructureRepo.setCost(r.survivorId, Some(combined))
              _   <- RestructureRepo.setRestructuredFrom(r.survivorId, List(r.survivorId, r.mergedId).asJson)
              _   <- RestructureRepo.supersede(r.mergedId, r.survivorId)
              op  <- RestructureRepo.recordFull("merge", before, after, before, after)
            } yield Right(MergeResult(op, r.survivorId, r.mergedId, combined)): Out[MergeResult]
          }
      } yield res
      tx.transact(xa)
    }
  }

  /** AC4 — split an asset into `intoCount` children with cost allocated to sum to the original. */
  def split(xa: Transactor[IO], p: Principal, r: SplitReq): IO[Out[SplitResult]] = {
    if (r.intoCount < 2) IO.pure(Left(badReq("intoCount must be >= 2")))
    else {
      val tx = for {
        w     <- canWrite(p)
        basics <- RestructureRepo.assetBasics(r.assetId)
        res <-
          if (!w) (Left(forbidden): Out[SplitResult]).pure[ConnectionIO]
          else basics match {
            case None => (Left(notFound): Out[SplitResult]).pure[ConnectionIO]
            case Some((owner, cat, title, costOpt)) =>
              val total = costOpt.getOrElse(0L)
              val allocs = RestructureService.splitCost(total, r.intoCount)
              for {
                children <- allocs.zipWithIndex.traverse { case (alloc, i) =>
                  RestructureRepo.createBare(owner.getOrElse(p.userId), s"$title (${i + 1}/${r.intoCount})", cat, Some(r.assetId), Some(alloc), None, None, None)
                }
                _  <- RestructureRepo.supersedeNoSurvivor(r.assetId)
                before = Json.obj("parent" -> Json.obj("id" -> r.assetId.asJson, "costMinor" -> total.asJson))
                after  = Json.obj("children" -> children.zip(allocs).map { case (id, a) => Json.obj("id" -> id.asJson, "costMinor" -> a.asJson) }.asJson)
                op <- RestructureRepo.recordFull("split", before, after, before, after)
              } yield Right(SplitResult(op, r.assetId, children, allocs)): Out[SplitResult]
          }
      } yield res
      tx.transact(xa)
    }
  }

  /** AC3/AC5 — reverse a merge (restore survivor cost + un-supersede merged) or a split
    * (un-supersede parent + supersede the children). Records a linked reversal op. */
  def reverse(xa: Transactor[IO], p: Principal, opId: UUID): IO[Out[ReverseResult]] = {
    val tx = for {
      w  <- canWrite(p)
      op <- RestructureRepo.get(opId)
      res <-
        if (!w) (Left(forbidden): Out[ReverseResult]).pure[ConnectionIO]
        else op match {
          case None => (Left(notFound): Out[ReverseResult]).pure[ConnectionIO]
          case Some((kind, _, outputs)) => doReverse(opId, kind, outputs).map(rid => Right(ReverseResult(opId, rid, kind)): Out[ReverseResult])
        }
    } yield res
    tx.transact(xa)
  }

  private def doReverse(opId: UUID, kind: String, outputs: Json): ConnectionIO[UUID] = kind match {
    case "merge" =>
      RestructureRepo.costBasisBefore(opId).flatMap { before =>
        val c          = before.map(_.hcursor).getOrElse(Json.obj().hcursor)
        val survivorId = c.downField("survivor").get[UUID]("id").toOption
        val survCost   = c.downField("survivor").get[Long]("costMinor").toOption
        val mergedId   = c.downField("merged").get[UUID]("id").toOption
        for {
          _  <- survivorId.traverse_(id => RestructureRepo.setCost(id, survCost))
          _  <- survivorId.traverse_(id => RestructureRepo.setRestructuredFrom(id, Json.Null))
          _  <- mergedId.traverse_(RestructureRepo.unsupersede)
          rid <- RestructureRepo.record("reverse_merge", outputs, Json.obj("restored" -> before.getOrElse(Json.obj())))
          _  <- RestructureRepo.markReversed(opId, rid)
        } yield rid
      }
    case "split" =>
      val children = outputs.hcursor.downField("children").values.toList.flatten.flatMap(_.hcursor.get[UUID]("id").toOption)
      val parentId = outputs.hcursor.downField("parent").get[UUID]("id").toOption // may be absent (split stores parent in `before`)
      for {
        _  <- children.traverse_(cid => RestructureRepo.supersedeNoSurvivor(cid))
        _  <- RestructureRepo.costBasisBefore(opId).flatMap(b => b.flatMap(_.hcursor.downField("parent").get[UUID]("id").toOption).orElse(parentId).traverse_(RestructureRepo.unsupersede))
        rid <- RestructureRepo.record("reverse_split", outputs, Json.obj())
        _  <- RestructureRepo.markReversed(opId, rid)
      } yield rid
    case _ => RestructureRepo.record("reverse_noop", Json.obj(), Json.obj())
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val legacyEndpoint  = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "assets" / "legacy").in(jsonBody[LegacyCreateReq]).errorOut(err).out(jsonBody[Created]).summary("Create a legacy asset (relaxed validation)")
  val mergeEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "assets" / "merge").in(jsonBody[MergeReq]).errorOut(err).out(jsonBody[MergeResult]).summary("Merge two assets (lineage + cost preserved)")
  val splitEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "assets" / "split").in(jsonBody[SplitReq]).errorOut(err).out(jsonBody[SplitResult]).summary("Split an asset into children (cost allocated)")
  val reverseEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "restructure" / path[UUID]("opId") / "reverse").errorOut(err).out(jsonBody[ReverseResult]).summary("Reverse a restructure operation")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    legacyEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: LegacyCreateReq) => legacyCreate(xa, p, r)),
    mergeEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: MergeReq) => merge(xa, p, r)),
    splitEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SplitReq) => split(xa, p, r)),
    reverseEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => reverse(xa, p, id)),
  )

  val endpoints: List[AnyEndpoint] = List(legacyEndpoint, mergeEndpoint, splitEndpoint, reverseEndpoint)
}
