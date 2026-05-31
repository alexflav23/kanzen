package com.kanzen.notify

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** A subscription joined to its user's role (the role drives F02 trimming at fan-out). */
final case class Subscription(
    id: UUID,
    userId: UUID,
    ownerId: UUID,
    role: String,
    pattern: String,
    channels: Json,
    active: Boolean
)

object SubscriptionRepo {

  /** True if a subscription's glob matches a concrete event type: `*` → everything `task.*` → any `task.…`
    * `task.completed` → exact.
    */
  def matches(pattern: String, eventType: String): Boolean =
    pattern == "*" ||
      pattern == eventType ||
      (pattern.endsWith(".*") && eventType.startsWith(pattern.dropRight(1)))

  /** All active subscriptions (with role), filtered to those matching the event type. */
  def matching(eventType: String): ConnectionIO[List[Subscription]] =
    all.map(_.filter(s => matches(s.pattern, eventType)))

  private def all: ConnectionIO[List[Subscription]] =
    sql"""select s.id, s.user_id, s.owner_id, u.role, s.event_type_pattern, s.channels, s.active
          from notification_subscriptions s join users u on u.id = s.user_id
          where s.active""".query[Subscription].to[List]

  def forUser(userId: UUID): ConnectionIO[List[Subscription]] =
    sql"""select s.id, s.user_id, s.owner_id, u.role, s.event_type_pattern, s.channels, s.active
          from notification_subscriptions s join users u on u.id = s.user_id
          where s.user_id = $userId order by s.event_type_pattern""".query[Subscription].to[List]

  def create(
      ownerId: UUID,
      userId: UUID,
      pattern: String,
      channels: Json,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"""insert into notification_subscriptions (tenant_id, owner_id, user_id, event_type_pattern, channels)
          values ($tenantId, $ownerId, $userId, $pattern, $channels) returning id""".query[UUID].unique

  /** Self-scoped delete (returns rows affected). */
  def delete(userId: UUID, id: UUID): ConnectionIO[Int] =
    sql"delete from notification_subscriptions where id = $id and user_id = $userId".update.run
}
