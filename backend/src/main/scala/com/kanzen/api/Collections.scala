package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.CollectionRepo
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F04 — asset collections: list/create named groupings of registry assets + view their members. Registry-private
  * (gated on `asset`). No aggregate value (that waits on the valuation-reporting decision); creates are audited.
  */
object Collections {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class CollectionView(id: UUID, name: String, description: Option[String], memberCount: Int)
  final case class CollectionRef(id: UUID, name: String)
  final case class MemberView(assetId: UUID, title: String)
  final case class CreateReq(name: String, description: Option[String])
  final case class AddMemberReq(assetId: UUID)
  final case class Ok(ok: Boolean)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the registry"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such collection."))
  private val badName: (StatusCode, ApiError) =
    (StatusCode.BadRequest, ApiError(400, "bad_request", "Collection name is required."))

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[CollectionView]]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        if (!authz.canRead("asset")) (Left(forbidden): Out[List[CollectionView]]).pure[ConnectionIO]
        else
          CollectionRepo.list.map(cs =>
            Right(cs.map(c => CollectionView(c.id, c.name, c.description, c.memberCount))): Out[List[CollectionView]]
          )
      }
      .transact(xa)

  def members(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[List[MemberView]]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      res <-
        if (!authz.canRead("asset")) (Left(forbidden): Out[List[MemberView]]).pure[ConnectionIO]
        else
          CollectionRepo.exists(id).flatMap {
            case false => (Left(notFound): Out[List[MemberView]]).pure[ConnectionIO]
            case true =>
              CollectionRepo
                .members(id)
                .map(ms => Right(ms.map(m => MemberView(m.assetId, m.title))): Out[List[MemberView]])
          }
    } yield res
    tx.transact(xa)
  }

  /** The collections a given asset is in (registry-private read). */
  def forAsset(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[List[CollectionRef]]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        if (!authz.canRead("asset")) (Left(forbidden): Out[List[CollectionRef]]).pure[ConnectionIO]
        else
          CollectionRepo
            .forAsset(assetId)
            .map(cs => Right(cs.map { case (i, n) => CollectionRef(i, n) }): Out[List[CollectionRef]])
      }
      .transact(xa)

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[CollectionView]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        if (!authz.can(Level.Write, "asset")) (Left(forbidden): Out[CollectionView]).pure[ConnectionIO]
        else if (req.name.trim.isEmpty) (Left(badName): Out[CollectionView]).pure[ConnectionIO]
        else
          CollectionRepo.create(p.userId, req.name.trim, req.description).flatMap { id =>
            AuditRepo
              .write(
                "user",
                Some(p.userId),
                "collection.create",
                Some("collection"),
                Some(id),
                Json.obj("name" -> req.name.trim.asJson),
                Some(p.userId)
              )
              .as(Right(CollectionView(id, req.name.trim, req.description, 0)): Out[CollectionView])
          }
      }
      .transact(xa)

  def addMember(xa: Transactor[IO], p: Principal, id: UUID, req: AddMemberReq): IO[Out[Ok]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      res <-
        if (!authz.can(Level.Write, "asset")) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else
          CollectionRepo.exists(id).flatMap {
            case false => (Left(notFound): Out[Ok]).pure[ConnectionIO]
            case true =>
              CollectionRepo.addMember(id, req.assetId) *>
                AuditRepo
                  .write(
                    "user",
                    Some(p.userId),
                    "collection.add_member",
                    Some("collection"),
                    Some(id),
                    Json.obj("assetId" -> req.assetId.toString.asJson),
                    Some(p.userId)
                  )
                  .as(Right(Ok(true)): Out[Ok])
          }
    } yield res
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[CollectionView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "collections")
      .errorOut(err)
      .out(jsonBody[List[CollectionView]])
      .summary("List asset collections (registry-private)")

  val membersEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[MemberView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "collections" / path[UUID]("id") / "members")
      .errorOut(err)
      .out(jsonBody[List[MemberView]])
      .summary("Assets in a collection")

  val forAssetEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[CollectionRef], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("assetId") / "collections")
      .errorOut(err)
      .out(jsonBody[List[CollectionRef]])
      .summary("Collections a given asset belongs to")

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), CollectionView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "collections")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[CollectionView])
      .summary("Create a collection (Principal-write)")

  val addMemberEndpoint: Endpoint[String, (UUID, AddMemberReq), (StatusCode, ApiError), Ok, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "collections" / path[UUID]("id") / "members")
      .in(jsonBody[AddMemberReq])
      .errorOut(err)
      .out(jsonBody[Ok])
      .summary("Add an asset to a collection")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    membersEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => members(xa, p, id)),
    forAssetEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (aid: UUID) => forAsset(xa, p, aid)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    addMemberEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id: UUID, r: AddMemberReq) => addMember(xa, p, id, r) })
  )

  val endpoints: List[AnyEndpoint] =
    List(listEndpoint, membersEndpoint, forAssetEndpoint, createEndpoint, addMemberEndpoint)
}
