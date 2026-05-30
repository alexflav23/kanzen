package com.kanzen.inbox

import cats.syntax.all._
import com.kanzen.people.AssigneeScope
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.Instant
import java.util.UUID

/** W9 — the collaborative inbox read/write model over seeded threads (the sandbox stand-in for ingested Gmail). Staff
  * are scope-filtered to threads assigned to them or in their property (mirrors Tasks/Lists `AssigneeScope`).
  */
final case class InboxRow(
    id: UUID,
    address: String,
    label: String,
    kind: String,
    propertyId: Option[UUID],
    openCount: Long
)
final case class ThreadRow(
    id: UUID,
    inboxId: UUID,
    subject: Option[String],
    snippet: Option[String],
    fromName: Option[String],
    lastMessageAt: Instant,
    unread: Boolean,
    hasAttachments: Boolean,
    status: String,
    assigneeId: Option[UUID],
    proposalCount: Long
)
final case class MessageRow(
    id: UUID,
    direction: String,
    fromAddr: Option[String],
    sentAt: Instant,
    bodyText: Option[String],
    bodyHtml: Option[String]
)
final case class DraftRow(id: UUID, bodyHtml: String, authorName: Option[String], updatedAt: Instant)
final case class ProposalRow(
    id: UUID,
    actionType: String,
    status: String,
    title: Option[String],
    summary: Option[String],
    confidence: Option[BigDecimal]
)
final case class CommentRow(
    id: UUID,
    authorId: UUID,
    authorName: Option[String],
    body: String,
    mentions: List[UUID],
    createdAt: Instant,
    updatedAt: Option[Instant]
)
final case class AttachmentRow(id: UUID, filename: String, contentType: Option[String], sizeBytes: Option[Long])

/** A proposal with its action type + extracted payload, for execution on confirm. */
final case class ProposalFull(
    id: UUID,
    threadId: Option[UUID],
    actionType: String,
    status: String,
    payload: Option[Json]
)

object CollabInboxRepo {

  /** A Staff viewer only sees threads assigned to them, or in their property's inbox. Over `email_threads t` joined to
    * `mail_inboxes i`. Manager/Principal pass None.
    */
  private def scopePred(scope: Option[AssigneeScope]): Fragment = scope match {
    case None => Fragment.empty
    case Some(AssigneeScope(person, Some(prop))) => fr"and (t.assignee_id = $person or i.property_id = $prop)"
    case Some(AssigneeScope(person, None)) => fr"and t.assignee_id = $person"
  }

  /** Mailbox visibility tier (RBAC): principal sees all tiers, manager sees staff+manager, staff sees staff-tier only.
    * Applied over `mail_inboxes i` on every inbox/thread query so a hidden mailbox can't be reached by any path.
    */
  private def visibilityPred(role: String): Fragment = role match {
    case "principal" => Fragment.empty
    case "manager" => fr"and i.visibility in ('staff','manager')"
    case _ => fr"and i.visibility = 'staff'"
  }

  // for the inbox-list count subquery, the threads are aliased `t2` against the outer inbox `i`. The rail badge counts
  // the Inbox folder (open, not spam).
  private def countScope(scope: Option[AssigneeScope]): Fragment = scope match {
    case None => Fragment.empty
    case Some(AssigneeScope(person, Some(prop))) => fr"and (t2.assignee_id = $person or i.property_id = $prop)"
    case Some(AssigneeScope(person, None)) => fr"and t2.assignee_id = $person"
  }

  def inboxes(scope: Option[AssigneeScope], role: String): ConnectionIO[List[InboxRow]] = {
    val propF = scope match { // Staff see only their property's inboxes
      case Some(AssigneeScope(_, Some(prop))) => fr"and i.property_id = $prop"
      case _ => Fragment.empty
    }
    (fr"""select i.id, i.address, i.label, i.kind, i.property_id,
            (select count(*) from email_threads t2 where t2.inbox_id = i.id and t2.status = 'open' and t2.spam = false""" ++ countScope(
      scope
    ) ++ fr""")
          from mail_inboxes i where i.deleted_at is null""" ++ propF ++ visibilityPred(role) ++ fr"order by i.label")
      .query[InboxRow]
      .to[List]
  }

  /** Standard mailbox folders. Sent is derived (has an outbound message); Archive = done/archived; Spam = the flag;
    * Inbox = open & not spam (also the default "open" view across mailboxes).
    */
  private def folderPred(folder: String): Fragment = folder match {
    case "sent" =>
      fr"and exists (select 1 from email_messages m where m.thread_id = t.id and m.direction = 'outbound')"
    case "spam" => fr"and t.spam = true"
    case "archive" => fr"and t.status in ('done','archived') and t.spam = false"
    case _ => fr"and t.status = 'open' and t.spam = false" // inbox / default
  }

  def threads(
      inboxId: Option[UUID],
      folder: String,
      assignedTo: Option[UUID],
      scope: Option[AssigneeScope],
      role: String
  ): ConnectionIO[List[ThreadRow]] = {
    val inboxF = inboxId.fold(Fragment.empty)(id => fr"and t.inbox_id = $id")
    val assignF = assignedTo.fold(Fragment.empty)(a => fr"and t.assignee_id = $a")
    (fr"""select t.id, t.inbox_id, t.subject, t.snippet, t.from_name, t.last_message_at, t.unread, t.has_attachments,
            t.status, t.assignee_id,
            (select count(*) from agent_actions a where a.thread_id = t.id and a.status = 'proposed')
          from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where 1=1""" ++ folderPred(folder) ++ inboxF ++ assignF ++ scopePred(scope) ++ visibilityPred(role) ++
      fr"order by t.last_message_at desc")
      .query[ThreadRow]
      .to[List]
  }

  /** A single thread is visible iff it survives the scope predicate AND the mailbox's visibility tier. */
  def visible(threadId: UUID, scope: Option[AssigneeScope], role: String): ConnectionIO[Boolean] =
    (fr"""select exists(select 1 from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where t.id = $threadId""" ++ scopePred(scope) ++ visibilityPred(role) ++ fr")").query[Boolean].unique

  def thread(threadId: UUID): ConnectionIO[Option[ThreadRow]] =
    sql"""select t.id, t.inbox_id, t.subject, t.snippet, t.from_name, t.last_message_at, t.unread, t.has_attachments,
            t.status, t.assignee_id,
            (select count(*) from agent_actions a where a.thread_id = t.id and a.status = 'proposed')
          from email_threads t where t.id = $threadId""".query[ThreadRow].option

  def messages(threadId: UUID): ConnectionIO[List[MessageRow]] =
    sql"""select id, direction, from_addr, sent_at, body_text, body_html from email_messages
          where thread_id = $threadId order by sent_at""".query[MessageRow].to[List]

  def proposals(threadId: UUID): ConnectionIO[List[ProposalRow]] =
    sql"""select id, action_type, status, title, summary, confidence from agent_actions
          where thread_id = $threadId order by created_at""".query[ProposalRow].to[List]

  def comments(entityType: String, entityId: UUID): ConnectionIO[List[CommentRow]] =
    sql"""select c.id, c.author_id, u.display_name, c.body, c.mentions, c.created_at, c.updated_at
          from entity_comments c left join users u on u.id = c.author_id
          where c.entity_type = $entityType and c.entity_id = $entityId order by c.created_at"""
      .query[CommentRow]
      .to[List]

  /** One comment by id (for the edit path — we need the author + existing mentions to compute diff). */
  def comment(id: UUID): ConnectionIO[Option[CommentRow]] =
    sql"""select c.id, c.author_id, u.display_name, c.body, c.mentions, c.created_at, c.updated_at
          from entity_comments c left join users u on u.id = c.author_id
          where c.id = $id""".query[CommentRow].option

  /** Edit a comment — body + mentions; only the author. Returns updated row count. */
  def updateComment(id: UUID, authorId: UUID, body: String, mentions: List[UUID]): ConnectionIO[Int] =
    sql"""update entity_comments set body = $body, mentions = $mentions, updated_at = now()
          where id = $id and author_id = $authorId""".update.run

  def assign(threadId: UUID, assigneeId: Option[UUID]): ConnectionIO[Int] =
    sql"update email_threads set assignee_id = $assigneeId where id = $threadId".update.run

  def setStatus(threadId: UUID, status: String): ConnectionIO[Int] =
    sql"update email_threads set status = $status where id = $threadId".update.run

  def markRead(threadId: UUID, unread: Boolean): ConnectionIO[Int] =
    sql"update email_threads set unread = $unread where id = $threadId".update.run

  def addComment(
      ownerId: UUID,
      entityType: String,
      entityId: UUID,
      authorId: UUID,
      body: String,
      mentions: List[UUID]
  ): ConnectionIO[UUID] =
    sql"""insert into entity_comments (owner_id, entity_type, entity_id, author_id, body, mentions)
          values ($ownerId, $entityType, $entityId, $authorId, $body, $mentions) returning id""".query[UUID].unique

  // ── attachments + actionable proposals (W9.2) ───────────────────────────────
  def attachments(threadId: UUID): ConnectionIO[List[AttachmentRow]] =
    sql"""select at.id, at.filename, at.content_type, at.size_bytes
          from email_attachments at join email_messages m on m.id = at.message_id
          where m.thread_id = $threadId order by at.filename""".query[AttachmentRow].to[List]

  def proposal(id: UUID): ConnectionIO[Option[ProposalFull]] =
    sql"select id, thread_id, action_type, status, payload from agent_actions where id = $id".query[ProposalFull].option

  /** Title for a linked asset (the review popup labels what an event will be attached to). */
  def assetTitle(id: UUID): ConnectionIO[Option[String]] =
    sql"select title from assets where id = $id".query[String].option

  /** Display labels for the review popup, per chosen primitive. */
  def listName(id: UUID): ConnectionIO[Option[String]] =
    sql"select name from shopping_lists where id = $id".query[String].option
  def personName(id: UUID): ConnectionIO[Option[String]] =
    sql"select name from employment_records where id = $id".query[String].option

  // ── reply / send + shared drafts (W9.4a) ────────────────────────────────────
  /** The address a reply is sent *from* (the thread's inbox) and *to* (the latest inbound sender). */
  def replyEnvelope(threadId: UUID): ConnectionIO[Option[(String, Option[String])]] =
    sql"""select i.address,
            (select m.from_addr from email_messages m
              where m.thread_id = t.id and m.direction = 'inbound' order by m.sent_at desc limit 1)
          from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where t.id = $threadId""".query[(String, Option[String])].option

  def draft(threadId: UUID): ConnectionIO[Option[DraftRow]] =
    sql"""select d.id, d.body_html, u.display_name, d.updated_at
          from email_drafts d left join users u on u.id = d.author_id
          where d.thread_id = $threadId""".query[DraftRow].option

  /** Upsert the single shared draft on a thread (last writer wins). */
  def upsertDraft(ownerId: UUID, threadId: UUID, authorId: UUID, html: String): ConnectionIO[Int] =
    sql"""insert into email_drafts (owner_id, thread_id, author_id, body_html)
          values ($ownerId, $threadId, $authorId, $html)
          on conflict (thread_id) do update set body_html = excluded.body_html,
            author_id = excluded.author_id, updated_at = now()""".update.run

  def deleteDraft(threadId: UUID): ConnectionIO[Int] =
    sql"delete from email_drafts where thread_id = $threadId".update.run

  /** Record an outbound reply on the thread (sandbox: the message row is the artifact; live: GmailSender also
    * dispatches — see the EmailSender seam). Bumps the thread's last activity and marks it read.
    */
  def sendMessage(
      ownerId: UUID,
      threadId: UUID,
      fromAddr: String,
      toAddr: Option[String],
      subject: Option[String],
      html: String,
      text: String,
      sentBy: UUID
  ): ConnectionIO[UUID] =
    for {
      id <-
        sql"""insert into email_messages (owner_id, thread_id, direction, from_addr, to_addrs, subject, body_text, body_html, sent_by)
                  values ($ownerId, $threadId, 'outbound', $fromAddr, $toAddr, $subject, $text, $html, $sentBy)
                  returning id""".query[UUID].unique
      _ <- sql"update email_threads set last_message_at = now(), unread = false where id = $threadId".update.run
      _ <- deleteDraft(threadId)
    } yield id

  /** The thread's inbox property (for scoping the created record). */
  def threadProperty(threadId: UUID): ConnectionIO[Option[UUID]] =
    sql"""select i.property_id from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where t.id = $threadId""".query[Option[UUID]].option.map(_.flatten)

  def confirmProposal(id: UUID): ConnectionIO[Int] =
    sql"update agent_actions set status = 'confirmed' where id = $id and status = 'proposed'".update.run
  def rejectProposal(id: UUID): ConnectionIO[Int] =
    sql"update agent_actions set status = 'rejected' where id = $id and status = 'proposed'".update.run

  /** Link the thread to a created record (provenance both ways, spec §11a). */
  def link(ownerId: UUID, threadId: UUID, targetType: String, targetId: UUID, createdBy: UUID): ConnectionIO[Int] =
    sql"""insert into entity_links (owner_id, source_type, source_id, target_type, target_id, role, created_by)
          values ($ownerId, 'email_thread', $threadId, $targetType, $targetId, 'created', $createdBy)
          on conflict do nothing""".update.run

  /** Back-reference: the email threads linked to a record (e.g. an asset/expense/calendar event), so its page can
    * answer "what mail concerns this?". Scope-filtered — Staff never see threads outside their own/property (no leak).
    */
  def linkedThreads(
      targetType: String,
      targetId: UUID,
      scope: Option[AssigneeScope],
      role: String
  ): ConnectionIO[List[ThreadRow]] =
    (fr"""select t.id, t.inbox_id, t.subject, t.snippet, t.from_name, t.last_message_at, t.unread, t.has_attachments,
            t.status, t.assignee_id,
            (select count(*) from agent_actions a where a.thread_id = t.id and a.status = 'proposed')
          from entity_links l
            join email_threads t on t.id = l.source_id and l.source_type = 'email_thread'
            join mail_inboxes i on i.id = t.inbox_id
          where l.target_type = $targetType and l.target_id = $targetId""" ++ scopePred(scope) ++ visibilityPred(
      role
    ) ++
      fr"order by t.last_message_at desc").query[ThreadRow].to[List]
}
