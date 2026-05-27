package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.GroupRepo
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F04 (W1.5) — asset groups: structural **peer** groupings (e.g. four chairs from one order), distinct from
  * `parent_asset_id` structured sets and from logical collections. Registry-private with the Manager carve-out (gated
  * on the `asset` resource, like collections); every change is audited.
  */
object Groups {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val KINDS = Set("order", "set", "rig", "other")

  final case class GroupView(id: UUID, name: String, kind: String, notes: Option[String], memberCount: Int)
  final case class GroupRef(id: UUID, name: String, kind: String)
  final case class CreateReq(name: String, kind: String, notes: Option[String])
  final case class AddReq(groupId: UUID)
  final case class Ok(ok: Boolean)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the registry"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such group."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[GroupView]]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        if (!authz.can(Actions.byKey("asset:view"))) (Left(forbidden): Out[List[GroupView]]).pure[ConnectionIO]
        else
          GroupRepo.list.map(gs =>
            Right(gs.map(g => GroupView(g.id, g.name, g.kind, g.notes, g.memberCount))): Out[List[GroupView]]
          )
      }
      .transact(xa)

  def forAsset(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[GroupRef]]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        if (!authz.can(Actions.byKey("asset:view"))) (Left(forbidden): Out[List[GroupRef]]).pure[ConnectionIO]
        else
          GroupRepo.forAsset(assetId).map(gs => Right(gs.map(g => GroupRef(g.id, g.name, g.kind))): Out[List[GroupRef]])
      }
      .transact(xa)

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[GroupView]] =
    if (req.name.trim.isEmpty) IO.pure(Left(badReq("name is required")))
    else if (!KINDS.contains(req.kind)) IO.pure(Left(badReq(s"kind must be one of ${KINDS.mkString(", ")}")))
    else
      Authz
        .forUser(p.userId, p.role)
        .flatMap { authz =>
          if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[GroupView]).pure[ConnectionIO]
          else
            GroupRepo.create(p.userId, req.name.trim, req.kind, req.notes).flatMap { id =>
              AuditRepo
                .write(
                  "user",
                  Some(p.userId),
                  "group.create",
                  Some("asset_group"),
                  Some(id),
                  io.circe.Json.obj("name" -> req.name.trim.asJson, "kind" -> req.kind.asJson),
                  Some(p.userId)
                )
                .as(Right(GroupView(id, req.name.trim, req.kind, req.notes, 0)): Out[GroupView])
            }
        }
        .transact(xa)

  def addToGroup(xa: Transactor[IO], p: Principal, assetId: UUID, req: AddReq): IO[Out[Ok]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- GroupRepo.exists(req.groupId)
      res <-
        if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Ok]).pure[ConnectionIO]
        else
          (GroupRepo.addMember(req.groupId, assetId) *>
            AuditRepo.write(
              "user",
              Some(p.userId),
              "group.add_member",
              Some("asset_group"),
              Some(req.groupId),
              io.circe.Json.obj("assetId" -> assetId.toString.asJson),
              Some(p.userId)
            )).as(Right(Ok(true)): Out[Ok])
    } yield res
    tx.transact(xa)
  }

  def removeFromGroup(xa: Transactor[IO], p: Principal, assetId: UUID, groupId: UUID): IO[Out[Ok]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      res <-
        if (!authz.can(Actions.byKey("asset:edit"))) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else
          (GroupRepo.removeMember(groupId, assetId) *>
            AuditRepo.write(
              "user",
              Some(p.userId),
              "group.remove_member",
              Some("asset_group"),
              Some(groupId),
              io.circe.Json.obj("assetId" -> assetId.toString.asJson),
              Some(p.userId)
            )).as(Right(Ok(true)): Out[Ok])
    } yield res
    tx.transact(xa)
  }

  // ---- endpoints ----
  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[GroupView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "asset-groups")
      .errorOut(err)
      .out(jsonBody[List[GroupView]])
      .summary("List asset groups (registry-private)")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), GroupView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "asset-groups")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[GroupView])
      .summary("Create an asset group (Manager+; kind order/set/rig/other)")

  val forAssetEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[GroupRef], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "groups")
      .errorOut(err)
      .out(jsonBody[List[GroupRef]])
      .summary("Groups a given asset belongs to")

  val addEndpoint: Endpoint[String, (UUID, AddReq), (StatusCode, ApiError), Ok, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "groups")
      .in(jsonBody[AddReq])
      .errorOut(err)
      .out(jsonBody[Ok])
      .summary("Add an asset to a group (Manager+)")

  val removeEndpoint: Endpoint[String, (UUID, UUID), (StatusCode, ApiError), Ok, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "groups" / path[UUID]("groupId"))
      .errorOut(err)
      .out(jsonBody[Ok])
      .summary("Remove an asset from a group (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    forAssetEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => forAsset(xa, p, id)),
    addEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addToGroup(xa, p, id, r) }),
    removeEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, gid) => removeFromGroup(xa, p, id, gid) })
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, createEndpoint, forAssetEndpoint, addEndpoint, removeEndpoint)
}
