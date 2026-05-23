package com.kanzen.events

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F34 — transactional outbox: events written in the same tx as the domain change,
  * then relayed to Pulsar by a publisher (here we model emit/unpublished/markPublished).
  */
object EventRepo {
  def emit(eventType: String, aggregateType: String, aggregateId: UUID, payload: Json): ConnectionIO[UUID] =
    sql"""insert into event_outbox (event_type, aggregate_type, aggregate_id, payload)
          values ($eventType, $aggregateType, $aggregateId, $payload) returning id""".query[UUID].unique

  def unpublished: ConnectionIO[List[(UUID, String)]] =
    sql"select id, event_type from event_outbox where published_at is null order by created_at".query[(UUID, String)].to[List]

  def markPublished(id: UUID): ConnectionIO[Int] =
    sql"update event_outbox set published_at = now() where id = $id".update.run
}
