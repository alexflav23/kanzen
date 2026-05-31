package com.kanzen.audit

import cats.data.NonEmptyList
import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.Instant
import java.util.UUID

/** Append-only audit log (`audit_log_entries`). Meaningful actions — especially security- sensitive ones like
  * impersonation — write an immutable entry here. The read side (F19/W2) powers the platform action log + per-entity
  * activity feeds; it's never mutated (corrections are new events).
  */
object AuditRepo {

  /** One audit entry with the actor's display name resolved (left join `users`). */
  final case class AuditRow(
      id: UUID,
      at: Instant,
      actorType: String,
      actorId: Option[UUID],
      actorName: Option[String],
      action: String,
      targetType: Option[String],
      targetId: Option[UUID],
      detail: Json
  )

  private val selectCols =
    fr"""select e.id, e.at, e.actor_type, e.actor_id, u.display_name, e.action, e.target_type, e.target_id, e.detail
         from audit_log_entries e left join users u on u.id = e.actor_id"""

  /** The platform action log — newest first, keyset-paginated by `at` (`before`), with optional actor/action/target
    * filters. `limit` is clamped by the caller.
    */
  def list(
      limit: Int,
      before: Option[Instant] = None,
      actor: Option[UUID] = None,
      action: Option[String] = None,
      targetType: Option[String] = None
  ): ConnectionIO[List[AuditRow]] = {
    val conds = List(
      before.map(b => fr"e.at < $b"),
      actor.map(a => fr"e.actor_id = $a"),
      action.map(a => fr"e.action = $a"),
      targetType.map(t => fr"e.target_type = $t")
    ).flatten
    val where =
      NonEmptyList.fromList(conds).fold(Fragment.empty)(c => fr"where" ++ c.reduceLeft((x, y) => x ++ fr"and" ++ y))
    (selectCols ++ where ++ fr"order by e.at desc limit $limit").query[AuditRow].to[List]
  }

  /** The activity feed for a single entity (its audit trail), newest first. */
  def forTarget(targetType: String, targetId: UUID, limit: Int): ConnectionIO[List[AuditRow]] =
    (selectCols ++ fr"where e.target_type = $targetType and e.target_id = $targetId order by e.at desc limit $limit")
      .query[AuditRow]
      .to[List]

  /** Distinct action keys present (for the audit-log filter dropdown). */
  def distinctActions: ConnectionIO[List[String]] =
    sql"select distinct action from audit_log_entries order by action".query[String].to[List]

  def write(
      actorType: String,
      actorId: Option[UUID],
      action: String,
      targetType: Option[String],
      targetId: Option[UUID],
      detail: Json,
      ownerId: Option[UUID],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[Int] =
    sql"""insert into audit_log_entries (tenant_id, actor_type, actor_id, action, target_type, target_id, detail, owner_id)
          values ($tenantId, $actorType, $actorId, $action, $targetType, $targetId, $detail, $ownerId)""".update.run
}
