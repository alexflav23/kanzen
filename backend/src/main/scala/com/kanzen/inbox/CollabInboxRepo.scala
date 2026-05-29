package com.kanzen.inbox

import cats.syntax.all._
import com.kanzen.people.AssigneeScope
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

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
    bodyText: Option[String]
)
final case class ProposalRow(
    id: UUID,
    actionType: String,
    status: String,
    title: Option[String],
    summary: Option[String],
    confidence: Option[BigDecimal]
)
final case class CommentRow(id: UUID, authorName: Option[String], body: String, createdAt: Instant)

object CollabInboxRepo {

  /** A Staff viewer only sees threads assigned to them, or in their property's inbox. Over `email_threads t` joined to
    * `mail_inboxes i`. Manager/Principal pass None.
    */
  private def scopePred(scope: Option[AssigneeScope]): Fragment = scope match {
    case None => Fragment.empty
    case Some(AssigneeScope(person, Some(prop))) => fr"and (t.assignee_id = $person or i.property_id = $prop)"
    case Some(AssigneeScope(person, None)) => fr"and t.assignee_id = $person"
  }
  // for the inbox-list count subquery, the threads are aliased `t2` against the outer inbox `i`
  private def countScope(scope: Option[AssigneeScope]): Fragment = scope match {
    case None => Fragment.empty
    case Some(AssigneeScope(person, Some(prop))) => fr"and (t2.assignee_id = $person or i.property_id = $prop)"
    case Some(AssigneeScope(person, None)) => fr"and t2.assignee_id = $person"
  }

  def inboxes(scope: Option[AssigneeScope]): ConnectionIO[List[InboxRow]] = {
    val visible = scope match { // Staff see only their property's inboxes
      case Some(AssigneeScope(_, Some(prop))) => fr"and i.property_id = $prop"
      case _ => Fragment.empty
    }
    (fr"""select i.id, i.address, i.label, i.kind, i.property_id,
            (select count(*) from email_threads t2 where t2.inbox_id = i.id and t2.status = 'open'""" ++ countScope(
      scope
    ) ++ fr""")
          from mail_inboxes i where i.deleted_at is null""" ++ visible ++ fr"order by i.label")
      .query[InboxRow]
      .to[List]
  }

  def threads(
      inboxId: Option[UUID],
      status: String,
      assignedTo: Option[UUID],
      scope: Option[AssigneeScope]
  ): ConnectionIO[List[ThreadRow]] = {
    val inboxF = inboxId.fold(Fragment.empty)(id => fr"and t.inbox_id = $id")
    val assignF = assignedTo.fold(Fragment.empty)(a => fr"and t.assignee_id = $a")
    (fr"""select t.id, t.inbox_id, t.subject, t.snippet, t.from_name, t.last_message_at, t.unread, t.has_attachments,
            t.status, t.assignee_id,
            (select count(*) from agent_actions a where a.thread_id = t.id and a.status = 'proposed')
          from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where t.status = $status""" ++ inboxF ++ assignF ++ scopePred(scope) ++ fr"order by t.last_message_at desc")
      .query[ThreadRow]
      .to[List]
  }

  /** A single thread is visible to a scope iff it survives the scope predicate. */
  def visible(threadId: UUID, scope: Option[AssigneeScope]): ConnectionIO[Boolean] =
    (fr"""select exists(select 1 from email_threads t join mail_inboxes i on i.id = t.inbox_id
          where t.id = $threadId""" ++ scopePred(scope) ++ fr")").query[Boolean].unique

  def thread(threadId: UUID): ConnectionIO[Option[ThreadRow]] =
    sql"""select t.id, t.inbox_id, t.subject, t.snippet, t.from_name, t.last_message_at, t.unread, t.has_attachments,
            t.status, t.assignee_id,
            (select count(*) from agent_actions a where a.thread_id = t.id and a.status = 'proposed')
          from email_threads t where t.id = $threadId""".query[ThreadRow].option

  def messages(threadId: UUID): ConnectionIO[List[MessageRow]] =
    sql"""select id, direction, from_addr, sent_at, body_text from email_messages
          where thread_id = $threadId order by sent_at""".query[MessageRow].to[List]

  def proposals(threadId: UUID): ConnectionIO[List[ProposalRow]] =
    sql"""select id, action_type, status, title, summary, confidence from agent_actions
          where thread_id = $threadId order by created_at""".query[ProposalRow].to[List]

  def comments(entityType: String, entityId: UUID): ConnectionIO[List[CommentRow]] =
    sql"""select c.id, u.display_name, c.body, c.created_at
          from entity_comments c left join users u on u.id = c.author_id
          where c.entity_type = $entityType and c.entity_id = $entityId order by c.created_at"""
      .query[CommentRow]
      .to[List]

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
}
