package com.kanzen.events

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F34 — transactional outbox: events written in the same tx as the domain change, then relayed (to Pulsar in
  * production; in-process [[Relay]] in sandbox). The relay marks rows published; a crash before commit leaves them
  * unpublished to resume next drain (AC3).
  */
object EventRepo {

  /** A raw outbox row; `payload` is the serialised [[Envelope]]. */
  final case class OutboxRow(
      id: UUID,
      eventType: String,
      aggregateType: String,
      aggregateId: Option[UUID],
      payload: Json
  )

  /** Emit a unified envelope — the producer path used by domain writes. */
  def emit(env: Envelope): ConnectionIO[UUID] =
    sql"""insert into event_outbox (event_type, aggregate_type, aggregate_id, payload)
          values (${env.eventType}, ${env.subject.`type`}, ${env.subject.id}, ${env.toJson})
          returning id""".query[UUID].unique

  /** Low-level emit (kept for callers/tests that build their own payload). */
  def emit(eventType: String, aggregateType: String, aggregateId: UUID, payload: Json): ConnectionIO[UUID] =
    sql"""insert into event_outbox (event_type, aggregate_type, aggregate_id, payload)
          values ($eventType, $aggregateType, $aggregateId, $payload) returning id""".query[UUID].unique

  def unpublished: ConnectionIO[List[(UUID, String)]] =
    sql"select id, event_type from event_outbox where published_at is null order by created_at"
      .query[(UUID, String)]
      .to[List]

  def unpublishedRows: ConnectionIO[List[OutboxRow]] =
    sql"""select id, event_type, aggregate_type, aggregate_id, payload
          from event_outbox where published_at is null order by created_at""".query[OutboxRow].to[List]

  def markPublished(id: UUID): ConnectionIO[Int] =
    sql"update event_outbox set published_at = now() where id = $id".update.run
}
