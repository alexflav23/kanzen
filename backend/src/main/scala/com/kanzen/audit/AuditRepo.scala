package com.kanzen.audit

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** Append-only audit log (`audit_log_entries`). Meaningful actions — especially security- sensitive ones like
  * impersonation — write an immutable entry here.
  */
object AuditRepo {
  def write(
      actorType: String,
      actorId: Option[UUID],
      action: String,
      targetType: Option[String],
      targetId: Option[UUID],
      detail: Json,
      ownerId: Option[UUID]
  ): ConnectionIO[Int] =
    sql"""insert into audit_log_entries (actor_type, actor_id, action, target_type, target_id, detail, owner_id)
          values ($actorType, $actorId, $action, $targetType, $targetId, $detail, $ownerId)""".update.run
}
