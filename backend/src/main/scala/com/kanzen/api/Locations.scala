package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.property.{Location, PropertyRepo}
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

/** F03 — the typed nested **location tree** under a property (rooms → areas → cabinets → shelves …). Reads need
  * property read + scope; writes need property write (Manager+; Staff can't edit locations — AC5). Enforces tree
  * integrity: a parent must be in the same property, no node may move under its own descendant (cycle), and a node with
  * live children can't be deleted (AC2/AC3).
  */
object Locations {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class LocationView(
      id: UUID,
      parentId: Option[UUID],
      kind: String,
      name: String,
      floor: Option[String],
      area: Option[String],
      notes: Option[String]
  )
  final case class CreateReq(
      propertyId: UUID,
      parentId: Option[UUID],
      kind: String,
      name: String,
      floor: Option[String],
      area: Option[String],
      notes: Option[String]
  )
  final case class PatchReq(name: String, notes: Option[String], floor: Option[String], area: Option[String])
  final case class MoveReq(newParentId: Option[UUID])
  final case class DeletedResp(deleted: UUID)

  private def view(l: Location): LocationView =
    LocationView(l.id, l.parentId, l.kind, l.name, l.floor, l.area, l.notes)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no write access to property"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such property or location."))
  private val conflict: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "archived", "Property is archived; new activity is blocked."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  /** May this principal write to `propertyId`? 404 if the property isn't in their scope (no leak), 409 if archived
    * (read-only, AC8), 403 if visible but the role can't write, else Right.
    */
  private def authorizeWrite(p: Principal, propertyId: UUID): ConnectionIO[Out[Unit]] =
    for {
      authz <- Authz.authorizer(p.role)
      prop <- PropertyRepo.listForPrincipal(p.userId).map(_.find(_.id == propertyId))
    } yield prop match {
      case None => Left(notFound)
      case Some(pr) if pr.status == "archived" => Left(conflict)
      case Some(_) if !authz.can(Level.Write, "property") => Left(forbidden)
      case Some(_) => Right(())
    }

  private def descendantsOf(all: List[Location], rootId: UUID): Set[UUID] = {
    val childrenOf: Map[UUID, List[UUID]] = all.flatMap(l => l.parentId.map(_ -> l.id)).groupMap(_._1)(_._2)
    @annotation.tailrec
    def loop(frontier: List[UUID], acc: Set[UUID]): Set[UUID] = frontier match {
      case Nil => acc
      case h :: t => val kids = childrenOf.getOrElse(h, Nil); loop(kids ::: t, acc ++ kids)
    }
    loop(List(rootId), Set.empty)
  }

  private def reload(id: UUID): ConnectionIO[Out[LocationView]] =
    PropertyRepo.findLocation(id).map(_.map(view).toRight(notFound))

  // ---- handlers (public so tests exercise the real authz/integrity path) ----

  def tree(xa: Transactor[IO], p: Principal, propertyId: UUID): IO[Out[List[LocationView]]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      visible <- PropertyRepo.listForPrincipal(p.userId).map(_.exists(_.id == propertyId))
      res <- (authz.canRead("property"), visible) match {
        case (false, _) => (Left(forbidden): Out[List[LocationView]]).pure[ConnectionIO]
        case (true, false) => (Left(notFound): Out[List[LocationView]]).pure[ConnectionIO]
        case (true, true) => PropertyRepo.locations(propertyId).map(ls => Right(ls.map(view)): Out[List[LocationView]])
      }
    } yield res
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[LocationView]] = {
    val tx = authorizeWrite(p, req.propertyId).flatMap {
      case Left(e) => (Left(e): Out[LocationView]).pure[ConnectionIO]
      case Right(_) =>
        val parentOk: ConnectionIO[Boolean] = req.parentId match {
          case None => true.pure[ConnectionIO]
          case Some(pid) => PropertyRepo.findLocation(pid).map(_.exists(_.propertyId == req.propertyId))
        }
        parentOk.flatMap {
          case false =>
            (Left(badReq("parent must be a location in the same property")): Out[LocationView]).pure[ConnectionIO]
          case true =>
            PropertyRepo
              .insertLocation(
                p.userId,
                req.propertyId,
                req.parentId,
                req.kind,
                req.name,
                req.floor,
                req.area,
                req.notes
              )
              .map(l => Right(view(l)): Out[LocationView])
        }
    }
    tx.transact(xa)
  }

  def patch(xa: Transactor[IO], p: Principal, id: UUID, req: PatchReq): IO[Out[LocationView]] = {
    val tx = PropertyRepo.findLocation(id).flatMap {
      case None => (Left(notFound): Out[LocationView]).pure[ConnectionIO]
      case Some(loc) =>
        authorizeWrite(p, loc.propertyId).flatMap {
          case Left(e) => (Left(e): Out[LocationView]).pure[ConnectionIO]
          case Right(_) => PropertyRepo.renameLocation(id, req.name, req.notes, req.floor, req.area) *> reload(id)
        }
    }
    tx.transact(xa)
  }

  def move(xa: Transactor[IO], p: Principal, id: UUID, req: MoveReq): IO[Out[LocationView]] = {
    val tx = PropertyRepo.findLocation(id).flatMap {
      case None => (Left(notFound): Out[LocationView]).pure[ConnectionIO]
      case Some(loc) =>
        authorizeWrite(p, loc.propertyId).flatMap {
          case Left(e) => (Left(e): Out[LocationView]).pure[ConnectionIO]
          case Right(_) =>
            req.newParentId match {
              case Some(np) if np == id =>
                (Left(badReq("a location cannot be its own parent")): Out[LocationView]).pure[ConnectionIO]
              case Some(np) =>
                PropertyRepo.locations(loc.propertyId).flatMap { all =>
                  if (!all.exists(_.id == np))
                    (Left(badReq("new parent must be in the same property")): Out[LocationView]).pure[ConnectionIO]
                  else if (descendantsOf(all, id).contains(np))
                    (Left(badReq("cannot move a location under its own descendant")): Out[LocationView])
                      .pure[ConnectionIO]
                  else PropertyRepo.reparent(id, Some(np)) *> reload(id)
                }
              case None => PropertyRepo.reparent(id, None) *> reload(id)
            }
        }
    }
    tx.transact(xa)
  }

  def delete(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[DeletedResp]] = {
    val tx = PropertyRepo.findLocation(id).flatMap {
      case None => (Left(notFound): Out[DeletedResp]).pure[ConnectionIO]
      case Some(loc) =>
        authorizeWrite(p, loc.propertyId).flatMap {
          case Left(e) => (Left(e): Out[DeletedResp]).pure[ConnectionIO]
          case Right(_) =>
            PropertyRepo.childCount(id).flatMap { n =>
              if (n > 0) (Left(badReq(s"move $n child location(s) first")): Out[DeletedResp]).pure[ConnectionIO]
              else PropertyRepo.softDeleteLocation(id).as(Right(DeletedResp(id)): Out[DeletedResp])
            }
        }
    }
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val treeEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[LocationView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "properties" / path[UUID]("id") / "locations")
      .errorOut(err)
      .out(jsonBody[List[LocationView]])
      .summary("The property's location tree (scoped)")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), LocationView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "locations")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[LocationView])
      .summary("Add a location to a property (Manager+)")

  val patchEndpoint: Endpoint[String, (UUID, PatchReq), (StatusCode, ApiError), LocationView, Any] =
    sttp.tapir.endpoint.patch
      .securityIn(auth.bearer[String]())
      .in("api" / "locations" / path[UUID]("id"))
      .in(jsonBody[PatchReq])
      .errorOut(err)
      .out(jsonBody[LocationView])
      .summary("Rename / edit a location (Manager+)")

  val moveEndpoint: Endpoint[String, (UUID, MoveReq), (StatusCode, ApiError), LocationView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "locations" / path[UUID]("id") / "move")
      .in(jsonBody[MoveReq])
      .errorOut(err)
      .out(jsonBody[LocationView])
      .summary("Reparent a location subtree (Manager+; cycle-safe)")

  val deleteEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), DeletedResp, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "locations" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[DeletedResp])
      .summary("Delete an empty location (Manager+; blocked if it has children)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    treeEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => tree(xa, p, id)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    patchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => patch(xa, p, id, r) }),
    moveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => move(xa, p, id, r) }),
    deleteEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => delete(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(treeEndpoint, createEndpoint, patchEndpoint, moveEndpoint, deleteEndpoint)
}
