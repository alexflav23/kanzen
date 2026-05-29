package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.inbox._
import com.kanzen.people.{AssigneeScope, PeopleRepo}
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

/** W9 — the Collaborative Inbox API (read + triage + collaborate over seeded threads; Gmail behind the seam). Staff are
  * scope-filtered to their own threads / property; assign/status/comment are authz-gated.
  */
object Inbox {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class InboxView(
      id: UUID,
      address: String,
      label: String,
      kind: String,
      propertyId: Option[UUID],
      openCount: Long
  )
  final case class ThreadView(
      id: UUID,
      inboxId: UUID,
      subject: Option[String],
      snippet: Option[String],
      fromName: Option[String],
      lastMessageAt: String,
      unread: Boolean,
      hasAttachments: Boolean,
      status: String,
      assigneeId: Option[UUID],
      proposalCount: Long
  )
  final case class MessageView(
      id: UUID,
      direction: String,
      fromAddr: Option[String],
      sentAt: String,
      bodyText: Option[String]
  )
  final case class ProposalView(
      id: UUID,
      actionType: String,
      status: String,
      title: Option[String],
      summary: Option[String],
      confidence: Option[Double]
  )
  final case class CommentView(id: UUID, authorName: Option[String], body: String, createdAt: String)
  final case class ThreadDetail(
      thread: ThreadView,
      messages: List[MessageView],
      proposals: List[ProposalView],
      comments: List[CommentView]
  )
  final case class AssignReq(assigneeId: Option[UUID])
  final case class StatusReq(status: String)
  final case class ReadReq(unread: Boolean)
  final case class CommentReq(body: String, mentions: Option[List[UUID]])

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the inbox"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such thread."))
  private val viewA = Actions.byKey("inbox:view")
  private val assignA = Actions.byKey("thread:assign")
  private val statusA = Actions.byKey("thread:status")
  private val commentA = Actions.byKey("thread:comment")
  private val validStatus = Set("open", "snoozed", "done", "archived")

  private def tv(t: ThreadRow): ThreadView =
    ThreadView(
      t.id,
      t.inboxId,
      t.subject,
      t.snippet,
      t.fromName,
      t.lastMessageAt.toString,
      t.unread,
      t.hasAttachments,
      t.status,
      t.assigneeId,
      t.proposalCount
    )
  private def iv(i: InboxRow): InboxView = InboxView(i.id, i.address, i.label, i.kind, i.propertyId, i.openCount)
  private def pv(p: ProposalRow): ProposalView =
    ProposalView(p.id, p.actionType, p.status, p.title, p.summary, p.confidence.map(_.toDouble))
  private def mv(m: MessageRow): MessageView = MessageView(m.id, m.direction, m.fromAddr, m.sentAt.toString, m.bodyText)
  private def cv(c: CommentRow): CommentView = CommentView(c.id, c.authorName, c.body, c.createdAt.toString)

  // Staff are scoped to their own threads / property; Manager/Principal see all.
  private def staffScope(p: Principal): ConnectionIO[Option[AssigneeScope]] =
    if (p.role == "staff") PeopleRepo.assigneeScope(p.userId) else Option.empty[AssigneeScope].pure[ConnectionIO]

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(viewA)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  /** A write on a thread: the action grant + (Staff) the thread being in their scope. */
  private def onThread[A](p: Principal, threadId: UUID, action: com.kanzen.authz.Action)(
      body: ConnectionIO[A]
  ): ConnectionIO[Out[A]] =
    for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <- staffScope(p)
      vis <- CollabInboxRepo.visible(threadId, scope)
      res <-
        if (!authz.can(action)) (Left(forbidden): Out[A]).pure[ConnectionIO]
        else if (!vis) (Left(notFound): Out[A]).pure[ConnectionIO]
        else body.map(a => Right(a): Out[A])
    } yield res

  def inboxes(xa: Transactor[IO], p: Principal): IO[Out[List[InboxView]]] =
    read(p, staffScope(p).flatMap(CollabInboxRepo.inboxes).map(_.map(iv))).transact(xa)

  def threads(
      xa: Transactor[IO],
      p: Principal,
      inbox: Option[UUID],
      status: Option[String],
      assignee: Option[String]
  ): IO[Out[List[ThreadView]]] =
    read(
      p,
      for {
        scope <- staffScope(p)
        me <-
          if (assignee.contains("me")) PeopleRepo.assigneeScope(p.userId).map(_.map(_.personId))
          else Option.empty[UUID].pure[ConnectionIO]
        rows <- CollabInboxRepo.threads(inbox, status.filter(validStatus).getOrElse("open"), me, scope)
      } yield rows.map(tv)
    ).transact(xa)

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ThreadDetail]] =
    read(
      p,
      for {
        scope <- staffScope(p)
        vis <- CollabInboxRepo.visible(id, scope)
        t <- CollabInboxRepo.thread(id)
        res <- (vis, t) match {
          case (true, Some(row)) =>
            for {
              _ <- CollabInboxRepo.markRead(id, unread = false)
              ms <- CollabInboxRepo.messages(id)
              ps <- CollabInboxRepo.proposals(id)
              cs <- CollabInboxRepo.comments("email_thread", id)
            } yield Right(ThreadDetail(tv(row.copy(unread = false)), ms.map(mv), ps.map(pv), cs.map(cv))): Out[
              ThreadDetail
            ]
          case _ => (Left(notFound): Out[ThreadDetail]).pure[ConnectionIO]
        }
      } yield res
    ).transact(xa).map(_.flatten)

  def assign(xa: Transactor[IO], p: Principal, id: UUID, r: AssignReq): IO[Out[Unit]] =
    onThread(p, id, assignA)(CollabInboxRepo.assign(id, r.assigneeId).void).transact(xa)

  def setStatus(xa: Transactor[IO], p: Principal, id: UUID, r: StatusReq): IO[Out[Unit]] =
    if (!validStatus(r.status))
      IO.pure(Left((StatusCode.UnprocessableEntity, ApiError(422, "bad_status", "Unknown status."))))
    else onThread(p, id, statusA)(CollabInboxRepo.setStatus(id, r.status).void).transact(xa)

  def markRead(xa: Transactor[IO], p: Principal, id: UUID, r: ReadReq): IO[Out[Unit]] =
    onThread(p, id, statusA)(CollabInboxRepo.markRead(id, r.unread).void).transact(xa)

  def comment(xa: Transactor[IO], p: Principal, id: UUID, r: CommentReq): IO[Out[CommentView]] =
    onThread(p, id, commentA)(
      CollabInboxRepo
        .addComment(p.userId, "email_thread", id, p.userId, r.body.trim, r.mentions.getOrElse(Nil))
        .flatMap(cid =>
          CollabInboxRepo
            .comments("email_thread", id)
            .map(_.find(_.id == cid).map(cv).getOrElse(CommentView(cid, None, r.body.trim, "")))
        )
    ).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val inboxesEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "inbox" / "inboxes")
    .errorOut(err)
    .out(jsonBody[List[InboxView]])
    .summary("Inboxes + open counts")
  val threadsEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "inbox" / "threads")
    .in(query[Option[UUID]]("inbox"))
    .in(query[Option[String]]("status"))
    .in(query[Option[String]]("assignee"))
    .errorOut(err)
    .out(jsonBody[List[ThreadView]])
    .summary("Threads in an inbox/view")
  val detailEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[ThreadDetail])
    .summary("Thread detail (messages, proposals, comments)")
  val assignEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "assign")
    .in(jsonBody[AssignReq])
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Assign a thread")
  val statusEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "status")
    .in(jsonBody[StatusReq])
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Set thread status (snooze/done/archive)")
  val readEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "read")
    .in(jsonBody[ReadReq])
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Mark read/unread")
  val commentEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "comments")
    .in(jsonBody[CommentReq])
    .errorOut(err)
    .out(jsonBody[CommentView])
    .summary("Internal comment (never outbound)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    inboxesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => inboxes(xa, p)),
    threadsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (i, s, asg) => threads(xa, p, i, s, asg) }),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    assignEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => assign(xa, p, id, r) }),
    statusEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => setStatus(xa, p, id, r) }),
    readEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => markRead(xa, p, id, r) }),
    commentEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => comment(xa, p, id, r) })
  )

  val endpoints: List[AnyEndpoint] = List(
    inboxesEndpoint,
    threadsEndpoint,
    detailEndpoint,
    assignEndpoint,
    statusEndpoint,
    readEndpoint,
    commentEndpoint
  )
}
