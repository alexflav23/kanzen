package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.property.{Property, PropertyCounts, PropertyRepo}
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

/** Phase 1 walking skeleton — `GET /api/properties`: the first DB-backed, authz-gated read. Bearer → `Principal`
  * (Cognito JWKS) → the role's rules from `permission_rules` (F02, default-deny) → `PropertyRepo.list` from Postgres,
  * or 403. Proves config → migrate → auth → authorize → query → JSON end-to-end.
  */
object Properties {
  final case class PropertyView(
      id: UUID,
      name: String,
      jurisdiction: Option[String],
      currency: String,
      status: String,
      rooms: Int,
      assets: Int,
      bills: Int,
      vendors: Int
  )

  /** Linked-system references (F03 §7) — reference only, never a secret (the 1Password field is a vault NAME). */
  final case class LinkedSystems(
      taskProject: Option[String],
      googleCalendar: Option[String],
      driveFolder: Option[String],
      onepasswordVault: Option[String]
  )

  /** The Bible aggregate — particulars + rooms/assets/bills/vendors tallies + linked systems. */
  final case class PropertyDetail(
      id: UUID,
      name: String,
      jurisdiction: Option[String],
      currency: String,
      status: String,
      rooms: Int,
      assets: Int,
      bills: Int,
      vendors: Int,
      // Overview depth (W4)
      address: Option[String],
      propType: Option[String],
      ownership: Option[String],
      buildingManagement: Option[String],
      linked: LinkedSystems
  )

  final case class CreateReq(
      name: String,
      address: Option[String],
      jurisdiction: Option[String],
      propType: Option[String],
      ownership: Option[String],
      currency: String
  )
  final case class PatchReq(
      name: String,
      address: Option[String],
      jurisdiction: Option[String],
      propType: Option[String],
      ownership: Option[String]
  )

  private type Out[A] = Either[(StatusCode, ApiError), A]
  // Single-property responses (create/patch/archive) feed a list refetch, so counts there are 0;
  // the list + detail compute real tallies.
  private def toView(r: Property, c: PropertyCounts = PropertyCounts(0, 0, 0, 0)): PropertyView =
    PropertyView(r.id, r.name, r.jurisdiction, r.defaultCurrency, r.status, c.rooms, c.assets, c.bills, c.vendors)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no write access to property"))
  // A scoped user must not learn that an out-of-scope property exists (F03 AC4).
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such property."))
  // Archived properties are read-only — new activity is blocked (F03 AC8).
  private val conflict: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "archived", "Property is archived; new activity is blocked."))

  /** Authorize against the principal's DB rules, then read what F02 scope allows — in one transaction. The handler is
    * public so tests can exercise the real authz + scope + query path without HTTP plumbing.
    */
  def list(xa: Transactor[IO], p: Principal): IO[Either[(StatusCode, ApiError), List[PropertyView]]] = {
    val tx: ConnectionIO[(Boolean, List[(Property, PropertyCounts)])] = for {
      authz <- Authz.forUser(p.userId, p.role)
      allowed = authz.can(Actions.byKey("property:view"))
      props <-
        if (allowed) PropertyRepo.listForPrincipalWithCounts(p.userId)
        else List.empty[(Property, PropertyCounts)].pure[ConnectionIO]
    } yield (allowed, props)

    tx.transact(xa).map {
      // Archived/sold properties are hidden from the default list (AC8); detail still reads them.
      case (true, props) => Right(props.collect { case (pr, c) if pr.status == "active" => toView(pr, c) })
      case (false, _) => Left(forbidden)
    }
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[PropertyView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("property:create"))) (Left(forbidden): Out[PropertyView]).pure[ConnectionIO]
      else
        PropertyRepo
          .insert(p.userId, req.name, req.address, req.jurisdiction, req.propType, req.ownership, req.currency)
          .map(pr => Right(toView(pr)): Out[PropertyView])
    }
    tx.transact(xa)
  }

  def patch(xa: Transactor[IO], p: Principal, id: UUID, req: PatchReq): IO[Out[PropertyView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      visible <- PropertyRepo.listForPrincipal(p.userId).map(_.find(_.id == id))
      res <- visible match {
        case None => (Left(notFound): Out[PropertyView]).pure[ConnectionIO]
        case Some(pr) =>
          if (pr.status == "archived") (Left(conflict): Out[PropertyView]).pure[ConnectionIO]
          else if (!authz.can(Actions.byKey("property:edit"))) (Left(forbidden): Out[PropertyView]).pure[ConnectionIO]
          else
            PropertyRepo.patchProperty(id, req.name, req.address, req.jurisdiction, req.propType, req.ownership) *>
              PropertyRepo.findProperty(id).map(_.map(pr => toView(pr)).toRight(notFound))
      }
    } yield res
    tx.transact(xa)
  }

  def archive(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[PropertyView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      visible <- PropertyRepo.listForPrincipal(p.userId).map(_.find(_.id == id))
      res <- visible match {
        case None => (Left(notFound): Out[PropertyView]).pure[ConnectionIO]
        case Some(_) =>
          if (!authz.can(Actions.byKey("property:edit"))) (Left(forbidden): Out[PropertyView]).pure[ConnectionIO]
          else PropertyRepo.archive(id) *> PropertyRepo.findProperty(id).map(_.map(pr => toView(pr)).toRight(notFound))
      }
    } yield res
    tx.transact(xa)
  }

  /** The scoped Bible read. 403 if the role can't read properties; 404 if the property isn't in the principal's scope
    * (existence not leaked); else the aggregate.
    */
  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Either[(StatusCode, ApiError), PropertyDetail]] = {
    val tx: ConnectionIO[Either[(StatusCode, ApiError), PropertyDetail]] = for {
      authz <- Authz.forUser(p.userId, p.role)
      visible <-
        if (authz.can(Actions.byKey("property:view"))) PropertyRepo.listForPrincipal(p.userId).map(_.find(_.id == id))
        else Option.empty[Property].pure[ConnectionIO]
      result <- (authz.can(Actions.byKey("property:view")), visible) match {
        case (false, _) => (Left(forbidden): Either[(StatusCode, ApiError), PropertyDetail]).pure[ConnectionIO]
        case (true, None) => (Left(notFound): Either[(StatusCode, ApiError), PropertyDetail]).pure[ConnectionIO]
        case (true, Some(pr)) =>
          (PropertyRepo.countsFor(id), PropertyRepo.particulars(id)).tupled
            .map { case (c, pt) =>
              Right(
                PropertyDetail(
                  pr.id,
                  pr.name,
                  pr.jurisdiction,
                  pr.defaultCurrency,
                  pr.status,
                  c.rooms,
                  c.assets,
                  c.bills,
                  c.vendors,
                  pt.address,
                  pt.propType,
                  pt.ownership,
                  pt.buildingManagement,
                  LinkedSystems(pt.taskProjectName, pt.googleCalendarId, pt.driveFolder, pt.onepasswordVault)
                )
              )
            }
      }
    } yield result
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[PropertyView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "properties")
      .errorOut(err)
      .out(jsonBody[List[PropertyView]])
      .summary("Properties visible to the principal (F03, authz + scope-filtered; archived hidden)")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), PropertyDetail, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[PropertyDetail])
      .summary("A property's Bible aggregate (scoped; 404 if out of scope)")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), PropertyView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "properties")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[PropertyView])
      .summary("Create a property (Manager+)")

  val patchEndpoint: Endpoint[String, (UUID, PatchReq), (StatusCode, ApiError), PropertyView, Any] =
    sttp.tapir.endpoint.patch
      .securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id"))
      .in(jsonBody[PatchReq])
      .errorOut(err)
      .out(jsonBody[PropertyView])
      .summary("Edit a property's particulars (Manager+; blocked if archived)")

  val archiveEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), PropertyView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id") / "archive")
      .errorOut(err)
      .out(jsonBody[PropertyView])
      .summary("Archive a property (Manager+; hidden from lists, records preserved)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    endpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    patchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => patch(xa, p, id, r) }),
    archiveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => archive(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(endpoint, detailEndpoint, createEndpoint, patchEndpoint, archiveEndpoint)
}
