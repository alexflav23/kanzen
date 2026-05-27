package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{AssetRepo, InsuranceRepo, Warranty}
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

  private def wview(w: Warranty): WarrantyView = WarrantyView(w.id, w.provider, w.startsOn, w.endsOn)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "not permitted"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))

  def warranties(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[WarrantyView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.canRead("asset")) (Left(forbidden): Out[List[WarrantyView]]).pure[ConnectionIO]
      else InsuranceRepo.warranties(assetId).map(ws => Right(ws.map(wview)): Out[List[WarrantyView]])
    }
    tx.transact(xa)
  }

  def addWarranty(xa: Transactor[IO], p: Principal, assetId: UUID, req: AddWarrantyReq): IO[Out[OkResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- AssetRepo.exists(assetId)
      res <-
        if (!authz.can(Level.Write, "asset")) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
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
      exists <- AssetRepo.exists(assetId)
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

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    warrantiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => warranties(xa, p, id)),
    addWarrantyEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => addWarranty(xa, p, id, r) }),
    getInsuranceEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => getInsurance(xa, p, id)),
    setInsuranceEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => setInsurance(xa, p, id, r) })
  )

  val endpoints: List[AnyEndpoint] =
    List(warrantiesEndpoint, addWarrantyEndpoint, getInsuranceEndpoint, setInsuranceEndpoint)
}
