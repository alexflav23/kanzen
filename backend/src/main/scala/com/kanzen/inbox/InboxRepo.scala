package com.kanzen.inbox

import doobie._
import doobie.implicits._

/** F26 — unified Inbox: live counts across the review streams. */
object InboxRepo {
  def counts: ConnectionIO[Map[String, Long]] =
    for {
      agent <- sql"select count(*) from agent_actions where status = 'proposed'".query[Long].unique
      reconciliation <- sql"select count(*) from bank_transactions where reconciliation_state = 'unmatched'"
        .query[Long]
        .unique
    } yield Map("agent" -> agent, "reconciliation" -> reconciliation)
}
