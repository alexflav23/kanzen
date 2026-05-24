package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{AssetRepo, Valuation, ValuationRepo}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F20 — dated valuation snapshots on an asset. Principal-only: the canonical
  * Manager-denied fields (`asset.valuation_snapshots` + `market_value`/`insured_value`,
  * F02). Current value = latest snapshot of each kind. */
object Valuations {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val KINDS = Set("acquisition", "replacement", "market", "insured", "appraisal", "realised")

  final case class ValuationView(id: UUID, assetId: UUID, kind: String, amountMinor: Long, currency: String)
  final case class RecordReq(kind: String, amountMinor: Long, currency: String, source: Option[String])

  private def view(v: Valuation): ValuationView = ValuationView(v.id, v.assetId, v.kind, v.amountMinor, v.currency)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "valuations are Principal-only"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def record(xa: Transactor[IO], p: Principal, assetId: UUID, req: RecordReq): IO[Out[ValuationView]] = {
    if (!KINDS.contains(req.kind)) IO.pure(Left(badReq(s"kind must be one of ${KINDS.mkString(", ")}")))
    else if (req.amountMinor < 0) IO.pure(Left(badReq("amount must be ≥ 0")))
    else {
      val tx = for {
        authz  <- Authz.authorizer(p.role)
        exists <- AssetRepo.exists(assetId)
        res <-
          if (!authz.can(Level.Write, "asset", Some("valuation_snapshots"))) (Left(forbidden): Out[ValuationView]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[ValuationView]).pure[ConnectionIO]
          else ValuationRepo.add(assetId, req.kind, req.amountMinor, req.currency, req.source).map(v => Right(view(v)): Out[ValuationView])
      } yield res
      tx.transact(xa)
    }
  }

  def list(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[ValuationView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.can(Level.Read, "asset", Some("valuation_snapshots"))) (Left(forbidden): Out[List[ValuationView]]).pure[ConnectionIO]
      else ValuationRepo.history(assetId).map(vs => Right(vs.map(view)): Out[List[ValuationView]])
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val recordEndpoint: Endpoint[String, (UUID, RecordReq), (StatusCode, ApiError), ValuationView, Any] =
    sttp.tapir.endpoint.post.securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "valuations").in(jsonBody[RecordReq]).errorOut(err).out(jsonBody[ValuationView])
      .summary("Record a valuation snapshot (Principal-only)")

  val listEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[ValuationView], Any] =
    sttp.tapir.endpoint.get.securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "valuations").errorOut(err).out(jsonBody[List[ValuationView]])
      .summary("Valuation history (Principal-only)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    recordEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => record(xa, p, id, r) }),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => list(xa, p, id)),
  )

  val endpoints: List[AnyEndpoint] = List(recordEndpoint, listEndpoint)
}
