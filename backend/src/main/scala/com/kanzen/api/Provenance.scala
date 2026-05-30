package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{AssetParty, AssetPartyRepo, AssetRepo, InsuranceRepo, Warranty}
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz, Level}
import io.circe.Json
import io.circe.syntax._
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F21 — warranty, provenance & insurance on assets. Warranties are registry-managed (Manager+ write). Insurance
  * carries the Principal-private `insured_value`, so it is Principal-only (Manager denied via the field-level
  * Authorizer).
  */
object Provenance {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class WarrantyView(
      id: UUID,
      provider: Option[String],
      startsOn: Option[LocalDate],
      endsOn: Option[LocalDate]
  )
  final case class AddWarrantyReq(provider: Option[String], startsOn: Option[LocalDate], endsOn: Option[LocalDate])
  final case class InsuranceView(
      insured: Boolean,
      policyRef: Option[String],
      insurer: Option[String],
      insuredValueMinor: Option[Long],
      renewalOn: Option[LocalDate]
  )
  final case class SetInsuranceReq(
      insured: Boolean,
      policyRef: Option[String],
      insurer: Option[String],
      insuredValueMinor: Option[Long],
      renewalOn: Option[LocalDate]
  )
  final case class OkResult(ok: Boolean)
  final case class PartyView(id: UUID, role: String, name: String, note: Option[String])
  final case class AddPartyReq(role: String, name: String, note: Option[String])

  private val PARTY_ROLES = Set("maker", "restorer", "appraiser", "prior_owner", "dealer", "insurer", "other")

  private def wview(w: Warranty): WarrantyView = WarrantyView(w.id, w.provider, w.startsOn, w.endsOn)
  private def pview(p: AssetParty): PartyView = PartyView(p.id, p.role, p.name, p.note)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "not permitted"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def warranties(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[WarrantyView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("asset:view"))) (Left(forbidden): Out[List[WarrantyView]]).pure[ConnectionIO]
      else InsuranceRepo.warranties(assetId).map(ws => Right(ws.map(wview)): Out[List[WarrantyView]])
    }
    tx.transact(xa)
  }

  def addWarranty(xa: Transactor[IO], p: Principal, assetId: UUID, req: AddWarrantyReq): IO[Out[OkResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- AssetRepo.exists(assetId, p.tenantId)
      res <-
        if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[OkResult]).pure[ConnectionIO]
        else
          InsuranceRepo
            .addWarranty(assetId, req.provider, req.endsOn, req.startsOn)
            .as(Right(OkResult(true)): Out[OkResult])
    } yield res
    tx.transact(xa)
  }

  /** Insurance is Principal-only (carries `insured_value`). */
  def getInsurance(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[InsuranceView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Level.Read, "asset", Some("insured_value")))
        (Left(forbidden): Out[InsuranceView]).pure[ConnectionIO]
      else
        InsuranceRepo.get(assetId).map {
          case Some(i) =>
            Right(InsuranceView(i.insured, i.policyRef, i.insurer, i.insuredValueMinor, i.renewalOn)): Out[
              InsuranceView
            ]
          case None => Right(InsuranceView(insured = false, None, None, None, None)): Out[InsuranceView]
        }
    }
    tx.transact(xa)
  }

  def setInsurance(xa: Transactor[IO], p: Principal, assetId: UUID, req: SetInsuranceReq): IO[Out[OkResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- AssetRepo.exists(assetId, p.tenantId)
      res <-
        if (!authz.can(Level.Write, "asset", Some("insured_value"))) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[OkResult]).pure[ConnectionIO]
        else
          InsuranceRepo
            .set(assetId, req.insured, req.policyRef, req.insuredValueMinor, req.renewalOn, req.insurer)
            .as(Right(OkResult(true)): Out[OkResult])
    } yield res
    tx.transact(xa)
  }

  // ── provenance party-roles (F21) ──
  def parties(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[PartyView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("asset:view"))) (Left(forbidden): Out[List[PartyView]]).pure[ConnectionIO]
      else AssetPartyRepo.list(assetId).map(ps => Right(ps.map(pview)): Out[List[PartyView]])
    }
    tx.transact(xa)
  }

  def addParty(xa: Transactor[IO], p: Principal, assetId: UUID, req: AddPartyReq): IO[Out[PartyView]] = {
    if (!PARTY_ROLES.contains(req.role)) IO.pure(Left(badReq(s"role must be one of ${PARTY_ROLES.mkString(", ")}")))
    else if (req.name.trim.isEmpty) IO.pure(Left(badReq("name is required")))
    else {
      val tx = for {
        authz <- Authz.forUser(p.userId, p.role)
        exists <- AssetRepo.exists(assetId, p.tenantId)
        res <-
          if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[PartyView]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[PartyView]).pure[ConnectionIO]
          else
            for {
              party <- AssetPartyRepo.add(assetId, req.role, req.name.trim, req.note, p.userId)
              _ <- AuditRepo.write(
                "user",
                Some(p.userId),
                "asset.add_party",
                Some("asset"),
                Some(assetId),
                Json.obj("role" -> req.role.asJson, "name" -> req.name.trim.asJson),
                Some(p.userId)
              )
            } yield Right(pview(party)): Out[PartyView]
      } yield res
      tx.transact(xa)
    }
  }

  def deleteParty(xa: Transactor[IO], p: Principal, assetId: UUID, partyId: UUID): IO[Out[OkResult]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
      else
        AssetPartyRepo.delete(partyId, assetId) *>
          AuditRepo
            .write(
              "user",
              Some(p.userId),
              "asset.remove_party",
              Some("asset"),
              Some(assetId),
              Json.obj("partyId" -> partyId.asJson),
              Some(p.userId)
            )
            .as(Right(OkResult(true)): Out[OkResult])
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val warrantiesEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[WarrantyView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "warranties")
      .errorOut(err)
      .out(jsonBody[List[WarrantyView]])
      .summary("Asset warranties")

  val addWarrantyEndpoint: Endpoint[String, (UUID, AddWarrantyReq), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "warranties")
      .in(jsonBody[AddWarrantyReq])
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Add a warranty (Manager+)")

  val getInsuranceEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), InsuranceView, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "insurance")
      .errorOut(err)
      .out(jsonBody[InsuranceView])
      .summary("Asset insurance (Principal-only)")

  val setInsuranceEndpoint: Endpoint[String, (UUID, SetInsuranceReq), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.put
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "insurance")
      .in(jsonBody[SetInsuranceReq])
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Set asset insurance (Principal-only)")

  val partiesEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[PartyView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "parties")
      .errorOut(err)
      .out(jsonBody[List[PartyView]])
      .summary("Asset provenance party-roles (maker/restorer/appraiser/prior-owner/…)")

  val addPartyEndpoint: Endpoint[String, (UUID, AddPartyReq), (StatusCode, ApiError), PartyView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "parties")
      .in(jsonBody[AddPartyReq])
      .errorOut(err)
      .out(jsonBody[PartyView])
      .summary("Add a provenance party (Manager+; audited)")

  val deletePartyEndpoint: Endpoint[String, (UUID, UUID), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "parties" / path[UUID]("partyId"))
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Remove a provenance party (Manager+; audited)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    warrantiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => warranties(xa, p, id)),
    addWarrantyEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => addWarranty(xa, p, id, r) }),
    getInsuranceEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => getInsurance(xa, p, id)),
    setInsuranceEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => setInsurance(xa, p, id, r) }),
    partiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => parties(xa, p, id)),
    addPartyEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addParty(xa, p, id, r) }),
    deletePartyEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, pid) => deleteParty(xa, p, id, pid) })
  )

  val endpoints: List[AnyEndpoint] =
    List(
      warrantiesEndpoint,
      addWarrantyEndpoint,
      getInsuranceEndpoint,
      setInsuranceEndpoint,
      partiesEndpoint,
      addPartyEndpoint,
      deletePartyEndpoint
    )
}
