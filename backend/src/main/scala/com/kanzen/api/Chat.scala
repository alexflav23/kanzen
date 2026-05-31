package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.chat.{ChatRepo, ChatRow}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F48 RT.4 — direct/group chat. A chat is an entity (`entity_type='chat'`) whose members live in `entity_links` and
  * whose messages are `entity_comments` — so it reuses the generic CollabPanel (`/api/comments` with
  * `entityType='chat'`) and rides the F34 `comment.created` event + the F48 realtime layer for live messages. Auth is
  * membership; everything is tenant-scoped.
  */
object Chat {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class CreateChatReq(memberUserIds: List[UUID])
  final case class ChatView(id: UUID, members: List[String], lastMessage: Option[String], lastAt: Option[String])

  private def view(r: ChatRow): ChatView = ChatView(r.id, r.memberNames, r.lastMessage, r.lastAt)

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[ChatView]]] =
    ChatRepo.listFor(p.tenantId, p.userId).transact(xa).map(rs => Right(rs.map(view)))

  def create(xa: Transactor[IO], p: Principal, req: CreateChatReq): IO[Out[ChatView]] = {
    val others = req.memberUserIds.filter(_ != p.userId).distinct
    if (others.isEmpty)
      IO.pure(Left((StatusCode.BadRequest, ApiError(400, "bad_request", "a chat needs at least one other member"))))
    else {
      val chatId = UUID.randomUUID()
      (for {
        _ <- ChatRepo.create(p.tenantId, p.userId, chatId, others)
        // re-read so the view carries the resolved member names
        mine <- ChatRepo.listFor(p.tenantId, p.userId)
      } yield mine.find(_.id == chatId).map(view))
        .transact(xa)
        .map(_.toRight((StatusCode.InternalServerError, ApiError(500, "error", "chat not created"))))
    }
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[ChatView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "chats")
      .errorOut(err)
      .out(jsonBody[List[ChatView]])
      .summary("Your chats (DM/group), newest activity first")

  val createEndpoint: Endpoint[String, CreateChatReq, (StatusCode, ApiError), ChatView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "chats")
      .in(jsonBody[CreateChatReq])
      .errorOut(err)
      .out(jsonBody[ChatView])
      .summary("Start a chat with one or more people")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateChatReq) => create(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, createEndpoint)
}
