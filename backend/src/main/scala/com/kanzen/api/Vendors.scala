package com.kanzen.api

import cats.data.NonEmptyList
import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.property.PropertyRepo
import com.kanzen.vendor.{Vendor, VendorRepo}
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

/** F09 — vendors & contacts, with property-scoped approval (F02). Principal/Manager write; Staff read only vendors
  * approved for a property in their scope. A vendor is assignable only while its insurance is current (selectable
  * list).
  */
object Vendors {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class VendorView(
      id: UUID,
      name: String,
      `type`: String,
      trade: Option[String],
      ndaUntil: Option[LocalDate],
      insuranceUntil: Option[LocalDate],
      rating: Option[BigDecimal]
  )
  final case class VendorDetail(vendor: VendorView, approvedProperties: List[UUID])
  final case class CreateReq(
      name: String,
      `type`: Option[String],
      trade: Option[String],
      ndaUntil: Option[LocalDate],
      insuranceUntil: Option[LocalDate],
      rating: Option[BigDecimal]
  )
  final case class ApproveReq(propertyId: UUID)
  final case class OkResult(ok: Boolean)

  private def view(v: Vendor): VendorView =
    VendorView(v.id, v.name, v.`type`, v.trade, v.ndaUntil, v.insuranceUntil, v.rating)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to vendors"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such vendor."))

  private def scopedIds(p: Principal): ConnectionIO[Set[UUID]] =
    PropertyRepo.listForPrincipal(p.userId).map(_.map(_.id).toSet)

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[VendorView]]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- scopedIds(p)
      rows <-
        if (!authz.canRead("vendor")) List.empty[Vendor].pure[ConnectionIO]
        else if (p.role == "staff")
          NonEmptyList.fromList(scoped.toList).fold(List.empty[Vendor].pure[ConnectionIO])(VendorRepo.listForProperties)
        else VendorRepo.listAll
    } yield if (!authz.canRead("vendor")) Left(forbidden) else Right(rows.map(view))
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[VendorDetail]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- scopedIds(p)
      vendor <- VendorRepo.find(id)
      props <- vendor.fold(List.empty[UUID].pure[ConnectionIO])(v => VendorRepo.propertiesOf(v.id))
    } yield
      if (!authz.canRead("vendor")) Left(forbidden)
      else
        vendor match {
          case None => Left(notFound)
          case Some(v) =>
            val approvedInScope = props.exists(scoped.contains)
            if (p.role == "staff" && !approvedInScope) Left(forbidden) // not approved for any of their properties
            else Right(VendorDetail(view(v), props))
        }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[VendorView]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.can(Level.Write, "vendor")) (Left(forbidden): Out[VendorView]).pure[ConnectionIO]
      else
        VendorRepo
          .insert(
            p.userId,
            req.name,
            req.`type`.getOrElse("business"),
            req.trade,
            req.ndaUntil,
            req.insuranceUntil,
            req.rating
          )
          .map(v => Right(view(v)): Out[VendorView])
    }
    tx.transact(xa)
  }

  def approve(xa: Transactor[IO], p: Principal, vendorId: UUID, propertyId: UUID): IO[Out[OkResult]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- scopedIds(p)
      vendor <- VendorRepo.find(vendorId)
      res <-
        if (!authz.can(Level.Write, "vendor")) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
        else if (vendor.isEmpty) (Left(notFound): Out[OkResult]).pure[ConnectionIO]
        else if (!scoped.contains(propertyId)) (Left(notFound): Out[OkResult]).pure[ConnectionIO]
        else VendorRepo.approveForProperty(vendorId, propertyId).as(Right(OkResult(true)): Out[OkResult])
    } yield res
    tx.transact(xa)
  }

  def selectable(xa: Transactor[IO], p: Principal, propertyId: UUID): IO[Out[List[VendorView]]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      scoped <- scopedIds(p)
      rows <-
        if (authz.canRead("vendor") && scoped.contains(propertyId)) VendorRepo.selectableFor(propertyId)
        else List.empty[Vendor].pure[ConnectionIO]
    } yield
      if (!authz.canRead("vendor")) Left(forbidden)
      else if (!scoped.contains(propertyId)) Left(notFound)
      else Right(rows.map(view))
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[VendorView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "vendors")
      .errorOut(err)
      .out(jsonBody[List[VendorView]])
      .summary("Vendors (Staff see only their property's)")

  val selectableEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[VendorView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "vendors" / "selectable")
      .in(query[UUID]("property"))
      .errorOut(err)
      .out(jsonBody[List[VendorView]])
      .summary("Assignable vendors for a property (approved + insured)")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), VendorDetail, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "vendors" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[VendorDetail])
      .summary("A vendor + its approved properties")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), VendorView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "vendors")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[VendorView])
      .summary("Add a vendor (Manager+)")

  val approveEndpoint: Endpoint[String, (UUID, ApproveReq), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "vendors" / path[UUID]("id") / "properties")
      .in(jsonBody[ApproveReq])
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Approve a vendor for a property (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    selectableEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (prop: UUID) => selectable(xa, p, prop)),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    approveEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => approve(xa, p, id, r.propertyId) })
  )

  val endpoints: List[AnyEndpoint] =
    List(listEndpoint, selectableEndpoint, detailEndpoint, createEndpoint, approveEndpoint)
}
