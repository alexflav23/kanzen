package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authorizer, Authz}
import com.kanzen.calendar.CalendarRepo
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import com.kanzen.finance.ExpenseRepo
import com.kanzen.inbox._
import com.kanzen.lists.ListRepo
import com.kanzen.people.{AssigneeScope, PeopleRepo}
import com.kanzen.tasks.TaskRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID
import scala.util.Try

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
      bodyText: Option[String],
      bodyHtml: Option[String]
  )
  final case class DraftView(id: UUID, bodyHtml: String, authorName: Option[String], updatedAt: String)
  final case class ProposalView(
      id: UUID,
      actionType: String,
      status: String,
      title: Option[String],
      summary: Option[String],
      confidence: Option[Double]
  )
  final case class CommentView(id: UUID, authorName: Option[String], body: String, createdAt: String)
  final case class AttachmentView(id: UUID, filename: String, contentType: Option[String], sizeBytes: Option[Long])
  final case class ThreadDetail(
      thread: ThreadView,
      messages: List[MessageView],
      proposals: List[ProposalView],
      comments: List[CommentView],
      attachments: List[AttachmentView],
      draft: Option[DraftView]
  )
  final case class AssignReq(assigneeId: Option[UUID])
  final case class StatusReq(status: String)
  final case class ReadReq(unread: Boolean)
  final case class CommentReq(body: String, mentions: Option[List[UUID]])
  final case class DraftReq(bodyHtml: String)
  final case class SendReq(bodyHtml: String)

  /** W9.4b: turn a thread into a task (linked back to the thread). */
  final case class CreateTaskFromThreadReq(
      title: String,
      dueOn: Option[LocalDate],
      priority: Option[String],
      assigneeId: Option[UUID]
  )
  final case class CreatedFromThread(taskId: UUID, label: String)

  /** What confirming a proposal created (for the success toast). */
  final case class ConfirmResult(created: String, recordType: Option[String], label: Option[String])

  // ── proposal review detail (W9.4): the itemised receipt / dated event behind a proposal, for the confirm popup ──
  final case class ProposalLineItem(description: String, amountMinor: Option[Long], qty: Option[Int])
  final case class ProposalLink(targetType: String, label: String)
  final case class ProposalDetail(
      id: UUID,
      threadId: Option[UUID],
      actionType: String,
      kind: String, // "receipt" | "event" | "other" — drives the popup layout
      status: String,
      title: Option[String],
      summary: Option[String],
      confidence: Option[Double],
      willCreate: String, // plain-English "what pressing Confirm does"
      // receipt
      payee: Option[String],
      description: Option[String],
      currency: Option[String],
      totalMinor: Option[Long],
      category: Option[String],
      lineItems: List[ProposalLineItem],
      // event
      date: Option[String],
      time: Option[String],
      location: Option[String],
      // task
      assignee: Option[String],
      priority: Option[String],
      // list
      listName: Option[String],
      // records it will create / attach to
      links: List[ProposalLink]
  )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to the inbox"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such thread."))
  private val conflict: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "already_actioned", "Already actioned."))
  private val viewA = Actions.byKey("inbox:view")
  private val assignA = Actions.byKey("thread:assign")
  private val statusA = Actions.byKey("thread:status")
  private val commentA = Actions.byKey("thread:comment")
  private val mailSendA = Actions.byKey("mail:send")
  private val calendarCreateA = Actions.byKey("calendar:create")
  private val expenseCreateA = Actions.byKey("expense:create")
  private val taskCreateA = Actions.byKey("task:create")
  private val listCreateA = Actions.byKey("list:create")
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
  private def mv(m: MessageRow): MessageView =
    MessageView(m.id, m.direction, m.fromAddr, m.sentAt.toString, m.bodyText, m.bodyHtml)
  private def dv(d: DraftRow): DraftView = DraftView(d.id, d.bodyHtml, d.authorName, d.updatedAt.toString)

  /** Defence-in-depth scrub for reply HTML (the web also runs DOMPurify): drop script/style blocks, inline event
    * handlers, and `javascript:` URLs. We only ever emit Lexical-generated markup, so this is a backstop.
    */
  private def sanitizeHtml(html: String): String =
    html
      .replaceAll("(?is)<\\s*(script|style|iframe|object|embed)[^>]*>.*?<\\s*/\\s*\\1\\s*>", "")
      .replaceAll("(?is)\\son\\w+\\s*=\\s*\"[^\"]*\"", "")
      .replaceAll("(?is)\\son\\w+\\s*=\\s*'[^']*'", "")
      .replaceAll("(?is)javascript:", "")
  private def htmlToText(html: String): String =
    html.replaceAll("(?is)<br\\s*/?>", "\n").replaceAll("(?is)</p>", "\n").replaceAll("(?is)<[^>]+>", "").trim
  private def cv(c: CommentRow): CommentView = CommentView(c.id, c.authorName, c.body, c.createdAt.toString)
  private def av(a: AttachmentRow): AttachmentView = AttachmentView(a.id, a.filename, a.contentType, a.sizeBytes)

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
      vis <- CollabInboxRepo.visible(threadId, p.tenantId, scope, p.role)
      res <-
        if (!authz.can(action)) (Left(forbidden): Out[A]).pure[ConnectionIO]
        else if (!vis) (Left(notFound): Out[A]).pure[ConnectionIO]
        else body.map(a => Right(a): Out[A])
    } yield res

  /** F34 — emit a thread-subject event (the realtime layer (F48) pushes these to the thread's subscribers so the inbox
    * list + open thread update without a refresh). Runs inside the caller's tx alongside the write.
    */
  private def emitThread(p: Principal, threadId: UUID, eventType: String, payload: Json): ConnectionIO[Unit] =
    EventRepo
      .emit(Envelope(eventType, Actor.user(p.userId), Subject("email_thread", threadId), p.userId, None, payload))
      .void

  def inboxes(xa: Transactor[IO], p: Principal): IO[Out[List[InboxView]]] =
    read(p, staffScope(p).flatMap(s => CollabInboxRepo.inboxes(p.tenantId, s, p.role)).map(_.map(iv))).transact(xa)

  private val validFolder = Set("inbox", "sent", "spam", "archive")
  def threads(
      xa: Transactor[IO],
      p: Principal,
      inbox: Option[UUID],
      folder: Option[String],
      assignee: Option[String]
  ): IO[Out[List[ThreadView]]] =
    read(
      p,
      for {
        scope <- staffScope(p)
        me <-
          if (assignee.contains("me")) PeopleRepo.assigneeScope(p.userId).map(_.map(_.personId))
          else Option.empty[UUID].pure[ConnectionIO]
        rows <- CollabInboxRepo.threads(
          p.tenantId,
          inbox,
          folder.filter(validFolder).getOrElse("inbox"),
          me,
          scope,
          p.role
        )
      } yield rows.map(tv)
    ).transact(xa)

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ThreadDetail]] =
    read(
      p,
      for {
        scope <- staffScope(p)
        vis <- CollabInboxRepo.visible(id, p.tenantId, scope, p.role)
        t <- CollabInboxRepo.thread(id)
        res <- (vis, t) match {
          case (true, Some(row)) =>
            for {
              _ <- CollabInboxRepo.markRead(id, unread = false)
              ms <- CollabInboxRepo.messages(id)
              ps <- CollabInboxRepo.proposals(id)
              cs <- CollabInboxRepo.comments(p.tenantId, "email_thread", id)
              ats <- CollabInboxRepo.attachments(id)
              dr <- CollabInboxRepo.draft(id)
            } yield Right(
              ThreadDetail(tv(row.copy(unread = false)), ms.map(mv), ps.map(pv), cs.map(cv), ats.map(av), dr.map(dv))
            ): Out[
              ThreadDetail
            ]
          case _ => (Left(notFound): Out[ThreadDetail]).pure[ConnectionIO]
        }
      } yield res
    ).transact(xa).map(_.flatten)

  /** Back-reference: threads linked to a record (asset/expense/calendar), scope-filtered. */
  def linked(xa: Transactor[IO], p: Principal, targetType: String, targetId: UUID): IO[Out[List[ThreadView]]] =
    read(
      p,
      staffScope(p)
        .flatMap(s => CollabInboxRepo.linkedThreads(p.tenantId, targetType, targetId, s, p.role))
        .map(_.map(tv))
    )
      .transact(xa)

  /** The itemised detail behind a proposal (receipt line items / dated event + what Confirm will do), for the review
    * popup. Read-gated + scope-checked like the thread it belongs to.
    */
  def proposalDetail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ProposalDetail]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <- staffScope(p)
      prOpt <- CollabInboxRepo.proposal(id)
      res <- prOpt match {
        case None => (Left(notFound): Out[ProposalDetail]).pure[ConnectionIO]
        case Some(pr) if pr.threadId.isEmpty => (Left(notFound): Out[ProposalDetail]).pure[ConnectionIO]
        case Some(pr) =>
          val tid = pr.threadId.get
          CollabInboxRepo.visible(tid, p.tenantId, scope, p.role).flatMap { vis =>
            if (!vis || !authz.can(viewA)) (Left(forbidden): Out[ProposalDetail]).pure[ConnectionIO]
            else
              for {
                rowOpt <- CollabInboxRepo.proposals(tid).map(_.find(_.id == id))
                c = pr.payload.getOrElse(Json.Null).hcursor
                items = c.downField("items").as[List[ProposalLineItem]].getOrElse(Nil)
                assetLink <- c
                  .get[UUID]("assetId")
                  .toOption
                  .flatTraverse(aid => CollabInboxRepo.assetTitle(aid).map(_.map(t => ProposalLink("asset", t))))
                listName <- c.get[UUID]("listId").toOption.flatTraverse(CollabInboxRepo.listName)
                assignee <- c.get[UUID]("assigneeId").toOption.flatTraverse(CollabInboxRepo.personName)
              } yield {
                // the model picks the primitive; action_type IS that choice → the popup shape follows from it
                val kind = pr.actionType match {
                  case "create_receipt" | "reconcile_bill" => "receipt"
                  case "create_event" => "event"
                  case "create_task" => "task"
                  case "add_to_list" => "list"
                  case _ => "other"
                }
                val total = c.get[Long]("amountMinor").toOption.orElse {
                  val s = items.flatMap(_.amountMinor).sum
                  if (kind == "receipt" && items.nonEmpty) Some(s) else None
                }
                val links = assetLink.toList
                val willCreate = kind match {
                  case "receipt" => "an expense, logged for approval — Kanzen never moves money."
                  case "event" =>
                    if (links.nonEmpty) s"a calendar event, linked to ${links.head.label}." else "a calendar event."
                  case "task" => "a task" + assignee.fold(".")(a => s" assigned to $a.")
                  case "list" =>
                    s"${items.size} item${if (items.sizeIs == 1) "" else "s"} on ${listName.getOrElse("the list")}."
                  case _ => "the proposed action."
                }
                Right(
                  ProposalDetail(
                    id = pr.id,
                    threadId = pr.threadId,
                    actionType = pr.actionType,
                    kind = kind,
                    status = pr.status,
                    title = rowOpt.flatMap(_.title),
                    summary = rowOpt.flatMap(_.summary),
                    confidence = rowOpt.flatMap(_.confidence.map(_.toDouble)),
                    willCreate = willCreate,
                    payee = c.get[String]("payee").toOption,
                    description = c.get[String]("description").toOption,
                    currency = c.get[String]("currency").toOption,
                    totalMinor = total,
                    category = c.get[String]("category").toOption,
                    lineItems = items,
                    date = c.get[String]("date").toOption,
                    time = c.get[String]("time").toOption,
                    location = c.get[String]("location").toOption,
                    assignee = assignee,
                    priority = c.get[String]("priority").toOption,
                    listName = listName,
                    links = links
                  )
                ): Out[ProposalDetail]
              }
          }
      }
    } yield res
    tx.transact(xa)
  }

  def assign(xa: Transactor[IO], p: Principal, id: UUID, r: AssignReq): IO[Out[Unit]] =
    onThread(p, id, assignA)(
      CollabInboxRepo.assign(id, r.assigneeId) *>
        emitThread(p, id, Events.Thread.Assigned, Json.obj("assigneeId" -> r.assigneeId.asJson))
    ).transact(xa)

  def setStatus(xa: Transactor[IO], p: Principal, id: UUID, r: StatusReq): IO[Out[Unit]] =
    if (!validStatus(r.status))
      IO.pure(Left((StatusCode.UnprocessableEntity, ApiError(422, "bad_status", "Unknown status."))))
    else
      onThread(p, id, statusA)(
        CollabInboxRepo.setStatus(id, r.status) *>
          emitThread(p, id, Events.Thread.StatusSet, Json.obj("status" -> r.status.asJson))
      ).transact(xa)

  def markRead(xa: Transactor[IO], p: Principal, id: UUID, r: ReadReq): IO[Out[Unit]] =
    onThread(p, id, statusA)(CollabInboxRepo.markRead(id, r.unread).void).transact(xa)

  def comment(xa: Transactor[IO], p: Principal, id: UUID, r: CommentReq): IO[Out[CommentView]] =
    onThread(p, id, commentA)(
      CollabInboxRepo
        .addComment(p.userId, p.tenantId, "email_thread", id, p.userId, r.body.trim, r.mentions.getOrElse(Nil))
        .flatMap(cid =>
          CollabInboxRepo
            .comments(p.tenantId, "email_thread", id)
            .map(_.find(_.id == cid).map(cv).getOrElse(CommentView(cid, None, r.body.trim, "")))
        )
    ).transact(xa)

  /** Turn an email thread into a task (W9.4b spec §9): creates the task under the actor's authz, links the thread to it
    * (entity_links thread↔task), so the task surfaces on the thread and the thread's `<LinkedEmails>` on the task.
    */
  def threadToTask(
      xa: Transactor[IO],
      p: Principal,
      id: UUID,
      r: CreateTaskFromThreadReq
  ): IO[Out[CreatedFromThread]] = {
    val title = r.title.trim
    if (title.isEmpty)
      IO.pure(Left((StatusCode.UnprocessableEntity, ApiError(422, "empty", "Task needs a title."))))
    else
      onThread(p, id, Actions.byKey("inbox:view")) {
        Authz.forUser(p.userId, p.role).flatMap { authz =>
          if (!authz.can(Actions.byKey("task:create"))) (Left(forbidden): Out[CreatedFromThread]).pure[ConnectionIO]
          else
            for {
              t <- TaskRepo.createUnfiled(p.tenantId, title, r.dueOn, r.priority.getOrElse("normal"), r.assigneeId)
              _ <- CollabInboxRepo.link(p.userId, p.tenantId, id, "task", t.id, p.userId)
            } yield Right(CreatedFromThread(t.id, s"Task created: $title")): Out[CreatedFromThread]
        }
      }.transact(xa).map(_.flatten)
  }

  /** Save/replace the thread's shared draft (collaborators can co-author; gated like a comment). */
  def saveDraft(xa: Transactor[IO], p: Principal, id: UUID, r: DraftReq): IO[Out[Unit]] =
    onThread(p, id, commentA)(CollabInboxRepo.upsertDraft(p.userId, id, p.userId, sanitizeHtml(r.bodyHtml)).void)
      .transact(xa)

  /** Send a reply from the thread's inbox (W9.4a). Sandbox: records the outbound message + clears the draft; live: the
    * GmailSender seam also dispatches. Kanzen never sends without an explicit human action (`mail:send`).
    */
  def send(xa: Transactor[IO], p: Principal, id: UUID, r: SendReq): IO[Out[Unit]] =
    if (r.bodyHtml.trim.isEmpty)
      IO.pure(Left((StatusCode.UnprocessableEntity, ApiError(422, "empty", "Nothing to send."))))
    else
      onThread(p, id, mailSendA) {
        for {
          env <- CollabInboxRepo.replyEnvelope(id)
          t <- CollabInboxRepo.thread(id)
          (from, to) = env.getOrElse(("", Option.empty[String]))
          subject = t.flatMap(_.subject).map(s => if (s.startsWith("Re:")) s else s"Re: $s")
          html = sanitizeHtml(r.bodyHtml)
          msgId <- CollabInboxRepo.sendMessage(p.userId, id, from, to, subject, html, htmlToText(html), p.userId)
          // W9.4/F44 — record IS the artifact; enqueue the durable dispatch to Google (drained through the GmailSender seam).
          _ <- com.kanzen.inbox.GmailSendQueueRepo.enqueue(id, msgId)
          _ <- emitThread(p, id, Events.Thread.Replied, Json.obj("to" -> to.asJson, "subject" -> subject.asJson))
        } yield ()
      }.transact(xa)

  /** Execute a confirmed proposal: create the real record (calendar event / expense for approval — money-safe), link it
    * back to the thread (provenance), mark the proposal confirmed. Runs under the actor's authz.
    */
  private def execute(p: Principal, pr: ProposalFull, authz: Authorizer): ConnectionIO[Out[ConfirmResult]] = {
    val tid = pr.threadId.get
    val c = pr.payload.getOrElse(Json.Null).hcursor
    def str(k: String, d: String) = c.get[String](k).toOption.getOrElse(d)
    pr.actionType match {
      case "create_event" =>
        if (!authz.can(calendarCreateA)) (Left(forbidden): Out[ConfirmResult]).pure[ConnectionIO]
        else
          for {
            prop <- CollabInboxRepo.threadProperty(tid)
            title = str("title", "Event")
            date = c
              .get[String]("date")
              .toOption
              .flatMap(s => Try(LocalDate.parse(s)).toOption)
              .getOrElse(LocalDate.now)
            eid <- CalendarRepo.createNative(
              p.userId,
              p.tenantId,
              title,
              date,
              str("category", "manual"),
              prop,
              "agent",
              Some(tid)
            )
            _ <- CollabInboxRepo.link(p.userId, p.tenantId, tid, "calendar", eid, p.userId)
            // a service/maintenance event may also concern an asset (e.g. the car) — link the thread to it too
            _ <- c
              .get[UUID]("assetId")
              .toOption
              .traverse_(aid => CollabInboxRepo.link(p.userId, p.tenantId, tid, "asset", aid, p.userId))
            _ <- CollabInboxRepo.confirmProposal(pr.id)
          } yield Right(ConfirmResult("event", Some("calendar"), Some(title)))
      case "create_receipt" | "reconcile_bill" =>
        if (!authz.can(expenseCreateA)) (Left(forbidden): Out[ConfirmResult]).pure[ConnectionIO]
        else
          for {
            prop <- CollabInboxRepo.threadProperty(tid)
            payee = str("payee", "Unknown")
            amt = c.get[Long]("amountMinor").toOption.getOrElse(0L)
            ex <- ExpenseRepo.submit(
              p.userId,
              p.tenantId,
              Some(payee),
              c.get[String]("description").toOption,
              amt,
              str("currency", "GBP"),
              prop,
              None,
              false,
              false,
              None,
              p.userId
            )
            _ <- CollabInboxRepo.link(p.userId, p.tenantId, tid, "expense", ex.id, p.userId)
            _ <- CollabInboxRepo.confirmProposal(pr.id)
          } yield Right(ConfirmResult("expense", Some("expense"), Some(s"$payee — logged for approval")))
      case "create_task" =>
        if (!authz.can(taskCreateA)) (Left(forbidden): Out[ConfirmResult]).pure[ConnectionIO]
        else
          for {
            title <- (c.get[String]("title").toOption.getOrElse("Follow up")).pure[ConnectionIO]
            due = c.get[String]("date").toOption.flatMap(s => Try(LocalDate.parse(s)).toOption)
            assignee = c.get[UUID]("assigneeId").toOption
            t <- TaskRepo.createUnfiled(p.tenantId, title, due, str("priority", "normal"), assignee)
            _ <- CollabInboxRepo.link(p.userId, p.tenantId, tid, "task", t.id, p.userId)
            // a task may concern an asset (e.g. the car) — carry that link through too
            _ <- c
              .get[UUID]("assetId")
              .toOption
              .traverse_(aid => CollabInboxRepo.link(p.userId, p.tenantId, tid, "asset", aid, p.userId))
            _ <- CollabInboxRepo.confirmProposal(pr.id)
          } yield Right(ConfirmResult("task", Some("task"), Some(s"Task created: $title")))
      case "add_to_list" =>
        if (!authz.can(listCreateA)) (Left(forbidden): Out[ConfirmResult]).pure[ConnectionIO]
        else
          c.get[UUID]("listId").toOption match {
            case None => (Left(notFound): Out[ConfirmResult]).pure[ConnectionIO]
            case Some(listId) =>
              val items = c.downField("items").as[List[ProposalLineItem]].getOrElse(Nil)
              for {
                _ <- items.traverse_(it =>
                  ListRepo
                    .addItem(
                      listId,
                      it.description,
                      it.qty.getOrElse(1),
                      false,
                      None,
                      None,
                      None,
                      None,
                      Some(p.userId),
                      false
                    )
                    .void
                )
                _ <- CollabInboxRepo.link(p.userId, p.tenantId, tid, "list", listId, p.userId)
                _ <- CollabInboxRepo.confirmProposal(pr.id)
                name <- CollabInboxRepo.listName(listId)
              } yield Right(
                ConfirmResult("list", Some("list"), Some(s"${items.size} added to ${name.getOrElse("the list")}"))
              )
          }
      case _ =>
        CollabInboxRepo.confirmProposal(pr.id).as(Right(ConfirmResult("done", None, None)): Out[ConfirmResult])
    }
  }

  def confirmProposal(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ConfirmResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <- staffScope(p)
      prOpt <- CollabInboxRepo.proposal(id)
      res <- prOpt match {
        case None => (Left(notFound): Out[ConfirmResult]).pure[ConnectionIO]
        case Some(pr) if pr.status != "proposed" => (Left(conflict): Out[ConfirmResult]).pure[ConnectionIO]
        case Some(pr) if pr.threadId.isEmpty => (Left(notFound): Out[ConfirmResult]).pure[ConnectionIO]
        case Some(pr) =>
          CollabInboxRepo.visible(pr.threadId.get, p.tenantId, scope, p.role).flatMap { vis =>
            if (!vis || !authz.can(viewA)) (Left(forbidden): Out[ConfirmResult]).pure[ConnectionIO]
            else
              execute(p, pr, authz).flatTap {
                // F34 — `email_proposal.confirmed` only on a real confirm (execute may still 403 on the inner authz)
                case Right(_) =>
                  emitThread(
                    p,
                    pr.threadId.get,
                    Events.EmailProposal.Confirmed,
                    Json.obj("proposalId" -> pr.id.asJson, "actionType" -> pr.actionType.asJson)
                  )
                case Left(_) => ().pure[ConnectionIO]
              }
          }
      }
    } yield res
    tx.transact(xa)
  }

  def rejectProposal(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Unit]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <- staffScope(p)
      prOpt <- CollabInboxRepo.proposal(id)
      res <- prOpt.flatMap(_.threadId) match {
        case None => (Left(notFound): Out[Unit]).pure[ConnectionIO]
        case Some(tid) =>
          CollabInboxRepo.visible(tid, p.tenantId, scope, p.role).flatMap { vis =>
            if (!vis || !authz.can(viewA)) (Left(forbidden): Out[Unit]).pure[ConnectionIO]
            else
              CollabInboxRepo.rejectProposal(id) *>
                emitThread(p, tid, Events.EmailProposal.Rejected, Json.obj("proposalId" -> id.asJson))
                  .as(Right(()): Out[Unit])
          }
      }
    } yield res
    tx.transact(xa)
  }

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
    .in(query[Option[String]]("folder"))
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
  val linkedEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "inbox" / "links")
    .in(query[String]("targetType"))
    .in(query[UUID]("targetId"))
    .errorOut(err)
    .out(jsonBody[List[ThreadView]])
    .summary("Email threads linked to a record (back-reference)")
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
  val threadToTaskEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "task")
    .in(jsonBody[CreateTaskFromThreadReq])
    .errorOut(err)
    .out(jsonBody[CreatedFromThread])
    .summary("Turn an email thread into a task (linked back to the thread)")
  val commentEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "comments")
    .in(jsonBody[CommentReq])
    .errorOut(err)
    .out(jsonBody[CommentView])
    .summary("Internal comment (never outbound)")
  val draftEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "draft")
    .in(jsonBody[DraftReq])
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Save the shared draft on a thread")
  val sendEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "threads" / path[UUID]("id") / "send")
    .in(jsonBody[SendReq])
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Send a reply from the thread's inbox (human-initiated)")
  val proposalDetailEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "inbox" / "proposals" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[ProposalDetail])
    .summary("Itemised detail behind a proposal (for the review popup)")
  val confirmEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "proposals" / path[UUID]("id") / "confirm")
    .errorOut(err)
    .out(jsonBody[ConfirmResult])
    .summary("Confirm a proposal — create the record (calendar/expense) + link it back")
  val rejectEndpoint = endpoint.post
    .securityIn(bearer)
    .in("api" / "inbox" / "proposals" / path[UUID]("id") / "reject")
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Dismiss a proposal")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    proposalDetailEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (id: UUID) => proposalDetail(xa, p, id)),
    confirmEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => confirmProposal(xa, p, id)),
    rejectEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => rejectProposal(xa, p, id)),
    inboxesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => inboxes(xa, p)),
    threadsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (i, s, asg) => threads(xa, p, i, s, asg) }),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    linkedEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (tt, tid) => linked(xa, p, tt, tid) }),
    assignEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => assign(xa, p, id, r) }),
    statusEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => setStatus(xa, p, id, r) }),
    readEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => markRead(xa, p, id, r) }),
    commentEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => comment(xa, p, id, r) }),
    draftEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => saveDraft(xa, p, id, r) }),
    sendEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => send(xa, p, id, r) }),
    threadToTaskEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => threadToTask(xa, p, id, r) })
  )

  val endpoints: List[AnyEndpoint] = List(
    inboxesEndpoint,
    threadsEndpoint,
    detailEndpoint,
    linkedEndpoint,
    proposalDetailEndpoint,
    assignEndpoint,
    statusEndpoint,
    readEndpoint,
    commentEndpoint,
    draftEndpoint,
    sendEndpoint,
    threadToTaskEndpoint,
    confirmEndpoint,
    rejectEndpoint
  )
}
