package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import com.kanzen.inbox.CollabInboxRepo
import com.kanzen.people.{AssigneeScope, PeopleRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.syntax._
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** W9.4b — generic Collab API (§11a): comments + links on **any** entity, so the same `<CollabPanel>` works for
  * threads, tasks, assets, properties, etc. Authz is per-entity-type (each maps to the resource's `:view`/`:edit`
  * action via the F02v2 path); for email threads we additionally enforce the mailbox visibility tier (W9.4 RBAC).
  *
  * Comments are **internal-only** — a `@mention` writes a `comment_mentioned` event to the F34 outbox (notification
  * fanout happens at consumer time), and the body is never serialised into any outbound email (V2-AC7).
  */
object Collab {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class CommentView(
      id: UUID,
      entityType: String,
      entityId: UUID,
      authorId: UUID,
      authorName: Option[String],
      body: String,
      mentions: List[UUID],
      createdAt: String,
      updatedAt: Option[String]
  )
  final case class AddCommentReq(
      entityType: String,
      entityId: UUID,
      body: String,
      mentions: Option[List[UUID]]
  )

  /** W9.4b-ii: editing a comment — body + (re)derived mention set. The server only notifies *new* mentions. */
  final case class EditCommentReq(body: String, mentions: Option[List[UUID]])

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "Forbidden."))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "Not found."))
  private val unprocessable: (StatusCode, ApiError) =
    (StatusCode.UnprocessableEntity, ApiError(422, "invalid", "Invalid request."))

  /** Entity-type → action map (read, write). Adding a new entity = one row here. */
  private val readAction: Map[String, String] = Map(
    "email_thread" -> "inbox:view",
    "asset" -> "asset:view",
    "vehicle" -> "asset:view",
    "task" -> "task:view",
    "property" -> "property:view",
    "expense" -> "expense:view",
    "calendar" -> "calendar:view",
    "list" -> "list:view",
    "person" -> "person:view",
    "document" -> "document:view"
  )
  private val writeAction: Map[String, String] = Map(
    "email_thread" -> "thread:comment",
    "asset" -> "asset:edit",
    "vehicle" -> "asset:edit",
    "task" -> "task:edit",
    "property" -> "property:edit",
    "expense" -> "expense:edit",
    "calendar" -> "calendar:edit",
    "list" -> "list:edit",
    "person" -> "person:edit",
    "document" -> "document:edit"
  )

  /** Staff are scoped to their own threads/property for inbox-visibility checks. */
  private def staffScope(p: Principal): ConnectionIO[Option[AssigneeScope]] =
    if (p.role == "staff") PeopleRepo.assigneeScope(p.userId) else Option.empty[AssigneeScope].pure[ConnectionIO]

  /** The view-check for ANY entity: the resource action + (for email threads) the mailbox visibility tier so the
    * generic API can't be used as a back door into a thread the user can't see in the inbox.
    */
  private def canRead(p: Principal, entityType: String, entityId: UUID): ConnectionIO[Boolean] = {
    val keyOpt = readAction.get(entityType)
    keyOpt match {
      case None => false.pure[ConnectionIO]
      case Some(key) =>
        Authz.forUser(p.userId, p.role).flatMap { authz =>
          val grant = authz.can(Actions.byKey(key))
          if (!grant) false.pure[ConnectionIO]
          else if (entityType == "email_thread")
            staffScope(p).flatMap(s => CollabInboxRepo.visible(entityId, s, p.role))
          else true.pure[ConnectionIO]
        }
    }
  }

  private def canWrite(p: Principal, entityType: String, entityId: UUID): ConnectionIO[Boolean] = {
    val keyOpt = writeAction.get(entityType)
    keyOpt match {
      case None => false.pure[ConnectionIO]
      case Some(key) =>
        Authz.forUser(p.userId, p.role).flatMap { authz =>
          val grant = authz.can(Actions.byKey(key))
          if (!grant) false.pure[ConnectionIO]
          else if (entityType == "email_thread")
            staffScope(p).flatMap(s => CollabInboxRepo.visible(entityId, s, p.role))
          else true.pure[ConnectionIO]
        }
    }
  }

  // ── endpoints ───────────────────────────────────────────────────────────────
  def comments(xa: Transactor[IO], p: Principal, entityType: String, entityId: UUID): IO[Out[List[CommentView]]] =
    (for {
      ok <- canRead(p, entityType, entityId)
      res <-
        if (!ok) (Left(forbidden): Out[List[CommentView]]).pure[ConnectionIO]
        else
          CollabInboxRepo
            .comments(entityType, entityId)
            .map(rows =>
              Right(
                rows.map(r =>
                  CommentView(
                    r.id,
                    entityType,
                    entityId,
                    r.authorId,
                    r.authorName,
                    r.body,
                    r.mentions,
                    r.createdAt.toString,
                    r.updatedAt.map(_.toString)
                  )
                )
              ): Out[List[CommentView]]
            )
    } yield res).transact(xa)

  def addComment(xa: Transactor[IO], p: Principal, r: AddCommentReq): IO[Out[CommentView]] = {
    val body = r.body.trim
    if (body.isEmpty) IO.pure(Left(unprocessable))
    else
      (for {
        ok <- canWrite(p, r.entityType, r.entityId)
        out <-
          if (!ok) (Left(forbidden): Out[CommentView]).pure[ConnectionIO]
          else {
            val ms = r.mentions.getOrElse(Nil).distinct
            for {
              cid <- CollabInboxRepo.addComment(p.userId, r.entityType, r.entityId, p.userId, body, ms)
              // F34 — `comment.created` is the canonical event the realtime layer (F48) pushes to the entity's
              // subscribers; `comment_mentioned` is the per-mention notification companion (existing).
              _ <- EventRepo.emit(
                Envelope(
                  Events.Comment.Created,
                  Actor.user(p.userId),
                  Subject(r.entityType, r.entityId),
                  p.userId,
                  None,
                  Json.obj(
                    "commentId" -> cid.asJson,
                    "authorId" -> p.userId.asJson,
                    "mentions" -> ms.asJson,
                    "preview" -> body.take(140).asJson
                  )
                )
              )
              _ <- ms.traverse_ { uid =>
                val payload = Json.obj(
                  "commentId" -> cid.asJson,
                  "entityType" -> r.entityType.asJson,
                  "entityId" -> r.entityId.asJson,
                  "authorId" -> p.userId.asJson,
                  "mentionedUserId" -> uid.asJson,
                  "preview" -> body.take(140).asJson
                )
                EventRepo.emit(Events.Comment.Mentioned, r.entityType, r.entityId, payload).void
              }
              comments <- CollabInboxRepo.comments(r.entityType, r.entityId)
              row = comments.find(_.id == cid)
            } yield Right(
              CommentView(
                cid,
                r.entityType,
                r.entityId,
                p.userId,
                row.flatMap(_.authorName),
                body,
                ms,
                row.map(_.createdAt.toString).getOrElse(""),
                row.flatMap(_.updatedAt.map(_.toString))
              )
            ): Out[CommentView]
          }
      } yield out).transact(xa)
  }

  /** Edit a comment — author-only. Re-derives the mention set and emits `comment_mentioned` ONLY for newly-added
    * mentions (no double-notify of existing recipients on a typo fix).
    */
  def editComment(xa: Transactor[IO], p: Principal, id: UUID, r: EditCommentReq): IO[Out[CommentView]] = {
    val body = r.body.trim
    if (body.isEmpty) IO.pure(Left(unprocessable))
    else
      (for {
        existing <- CollabInboxRepo.comment(id)
        out <- existing match {
          case None => (Left(notFound): Out[CommentView]).pure[ConnectionIO]
          case Some(c) if c.authorId != p.userId =>
            // only the author can edit (no admin override for now — keep the surface tight)
            (Left(forbidden): Out[CommentView]).pure[ConnectionIO]
          case Some(c) =>
            for {
              refs <- sql"select entity_type, entity_id from entity_comments where id = $id"
                .query[(String, UUID)]
                .unique
              entityType <- refs._1.pure[ConnectionIO]
              entityId <- refs._2.pure[ConnectionIO]
              newMentions <- r.mentions.getOrElse(Nil).distinct.pure[ConnectionIO]
              added <- (newMentions.toSet -- c.mentions.toSet).toList.pure[ConnectionIO]
              n <- CollabInboxRepo.updateComment(id, p.userId, body, newMentions)
              // F34 — `comment.edited` lights up the realtime layer (F48); existing recipients see the "edited" badge
              // appear without a refresh. Mention-add still fires comment_mentioned for newly-added recipients only.
              _ <-
                if (n == 0) ().pure[ConnectionIO]
                else
                  EventRepo
                    .emit(
                      Envelope(
                        Events.Comment.Edited,
                        Actor.user(p.userId),
                        Subject(entityType, entityId),
                        p.userId,
                        None,
                        Json.obj(
                          "commentId" -> id.asJson,
                          "authorId" -> p.userId.asJson,
                          "mentions" -> newMentions.asJson,
                          "preview" -> body.take(140).asJson
                        )
                      )
                    )
                    .void
              _ <- added.traverse_ { uid =>
                val payload = Json.obj(
                  "commentId" -> id.asJson,
                  "entityType" -> entityType.asJson,
                  "entityId" -> entityId.asJson,
                  "authorId" -> p.userId.asJson,
                  "mentionedUserId" -> uid.asJson,
                  "preview" -> body.take(140).asJson
                )
                EventRepo.emit(Events.Comment.Mentioned, entityType, entityId, payload).void
              }
              fresh <- CollabInboxRepo.comment(id)
            } yield
              if (n == 0) Left(forbidden): Out[CommentView]
              else
                fresh
                  .map(f =>
                    Right(
                      CommentView(
                        f.id,
                        entityType,
                        entityId,
                        f.authorId,
                        f.authorName,
                        f.body,
                        f.mentions,
                        f.createdAt.toString,
                        f.updatedAt.map(_.toString)
                      )
                    ): Out[CommentView]
                  )
                  .getOrElse(Left(notFound))
        }
      } yield out).transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val getCommentsEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "comments")
    .in(query[String]("entityType"))
    .in(query[UUID]("entityId"))
    .errorOut(err)
    .out(jsonBody[List[CommentView]])
    .summary("Comments on any entity — generic Collab read")
  val addCommentEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "comments")
    .in(jsonBody[AddCommentReq])
    .errorOut(err)
    .out(jsonBody[CommentView])
    .summary("Add a comment on any entity — internal-only, mentions emit F34 events")
  val editCommentEndpoint = endpoint.patch
    .securityIn(bearer)
    .in("api" / "comments" / path[UUID]("id"))
    .in(jsonBody[EditCommentReq])
    .errorOut(err)
    .out(jsonBody[CommentView])
    .summary("Edit a comment — author-only; only NEW mentions notify")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    getCommentsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (et, eid) => comments(xa, p, et, eid) }),
    addCommentEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: AddCommentReq) => addComment(xa, p, r)),
    editCommentEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => editComment(xa, p, id, r) })
  )
  val endpoints: List[AnyEndpoint] = List(getCommentsEndpoint, addCommentEndpoint, editCommentEndpoint)
}
