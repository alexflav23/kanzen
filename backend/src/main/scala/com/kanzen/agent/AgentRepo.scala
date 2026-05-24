package com.kanzen.agent

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F25 — classification + action mapping (Claude/Bedrock in production; rules here). */
object AgentService {
  def classify(subject: String): String = {
    val s = subject.toLowerCase
    if (s.contains("invoice") || s.contains("statement") || s.contains("bill")) "Bill / Invoice"
    else if (s.contains("receipt")) "Receipt"
    else if (s.contains("delivery") || s.contains("dispatched") || s.contains("shipped")) "Delivery"
    else if (s.contains("appointment") || s.contains("booking")) "Booking"
    else "Other"
  }

  def proposedActions(category: String): List[String] = category match {
    case "Delivery"       => List("create_task", "create_event")
    case "Bill / Invoice" => List("file_document", "reconcile_bill")
    case "Receipt"        => List("file_document", "create_receipt", "propose_asset")
    case "Booking"        => List("create_event")
    case _                => Nil
  }
}

object AgentRepo {
  def ingest(mailbox: String, from: String, subject: String): ConnectionIO[(UUID, String)] = {
    val category = AgentService.classify(subject)
    sql"""insert into incoming_emails (mailbox, from_addr, subject, category)
          values ($mailbox, $from, $subject, $category) returning id""".query[UUID].unique.map(id => (id, category))
  }

  def propose(emailId: UUID, actionType: String): ConnectionIO[UUID] =
    sql"insert into agent_actions (email_id, action_type) values ($emailId, $actionType) returning id".query[UUID].unique

  def confirm(actionId: UUID): ConnectionIO[Int] =
    sql"update agent_actions set status = 'executed' where id = $actionId".update.run

  def reject(actionId: UUID): ConnectionIO[Int] =
    sql"update agent_actions set status = 'rejected' where id = $actionId".update.run

  /** Proposed actions joined to their email's category/subject (the Triage stream). */
  def listActions(status: String): ConnectionIO[List[AgentActionRow]] =
    sql"""select a.id, a.email_id, a.action_type, a.status, e.category, e.subject
          from agent_actions a join incoming_emails e on e.id = a.email_id
          where a.status = $status order by a.created_at desc""".query[AgentActionRow].to[List]

  /** (category, current status) of the email behind an action — drives F27 trust enforcement. */
  def actionCategory(actionId: UUID): ConnectionIO[Option[(String, String)]] =
    sql"""select coalesce(e.category, 'Other'), a.status from agent_actions a
          join incoming_emails e on e.id = a.email_id where a.id = $actionId""".query[(String, String)].option
}

final case class AgentActionRow(id: UUID, emailId: UUID, actionType: String, status: String, category: Option[String], subject: Option[String])
