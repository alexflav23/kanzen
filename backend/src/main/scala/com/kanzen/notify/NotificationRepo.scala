package com.kanzen.notify

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F34 — the in-app notification record. Insert is idempotent (unique on event_id+user_id), so a redelivered event
  * never double-notifies.
  */
final case class Notification(
    id: UUID,
    `type`: String,
    title: String,
    body: Option[String],
    subjectType: Option[String],
    subjectId: Option[UUID],
    channelsSent: Json,
    readAt: Option[String],
    createdAt: String
)

object NotificationRepo {
  def insert(
      userId: UUID,
      ownerId: UUID,
      eventId: UUID,
      typ: String,
      title: String,
      body: Option[String],
      subjectType: Option[String],
      subjectId: Option[UUID],
      channels: Json,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[Int] =
    sql"""insert into notifications (tenant_id, user_id, owner_id, event_id, type, title, body, subject_type, subject_id, channels_sent)
          values ($tenantId, $userId, $ownerId, $eventId, $typ, $title, $body, $subjectType, $subjectId, $channels)
          on conflict (event_id, user_id) do nothing""".update.run

  def forUser(userId: UUID): ConnectionIO[List[Notification]] =
    sql"""select id, type, title, body, subject_type, subject_id, channels_sent, read_at::text, created_at::text
          from notifications where user_id = $userId order by created_at desc limit 100"""
      .query[Notification]
      .to[List]

  def unreadCount(userId: UUID): ConnectionIO[Long] =
    sql"select count(*) from notifications where user_id = $userId and read_at is null".query[Long].unique

  /** Self-scoped: only marks a row the caller owns; returns rows affected (0 = not theirs / already read). */
  def markRead(userId: UUID, id: UUID): ConnectionIO[Int] =
    sql"update notifications set read_at = now() where id = $id and user_id = $userId and read_at is null".update.run

  // ── F34/APNs+FCM push delivery ───────────────────────────────────────────────
  /** One notification awaiting a device push (its channels include 'push' and it hasn't been pushed yet). */
  final case class PushPending(id: UUID, userId: UUID, title: String, body: Option[String])

  def pendingPush(limit: Int): ConnectionIO[List[PushPending]] =
    sql"""select id, user_id, title, body from notifications
          where pushed_at is null and channels_sent @> '["push"]'::jsonb order by created_at limit $limit"""
      .query[PushPending]
      .to[List]

  def markPushed(id: UUID): ConnectionIO[Int] =
    sql"update notifications set pushed_at = now(), push_error = null where id = $id".update.run

  def markPushError(id: UUID, err: String): ConnectionIO[Int] =
    sql"update notifications set push_error = $err where id = $id".update.run
}
