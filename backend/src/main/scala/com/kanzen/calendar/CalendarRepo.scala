package com.kanzen.calendar

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

/** A merged-view row: a native/Google event, or a read-only overlay from a task / maintenance plan. */
final case class CalEvent(id: UUID, title: String, startOn: Option[LocalDate], category: String, source: String)

/** F07 — calendar event refs synced with Google; idempotent by google_event_id. */
object CalendarRepo {
  def upsert(googleEventId: String, title: String, startOn: LocalDate, source: String): ConnectionIO[Int] =
    sql"""insert into calendar_event_refs (google_event_id, title, start_on, source)
          values ($googleEventId, $title, $startOn, $source)
          on conflict (google_event_id) do update set title = excluded.title, start_on = excluded.start_on""".update.run

  def list: ConnectionIO[List[(String, String)]] =
    sql"select coalesce(google_event_id, ''), title from calendar_event_refs order by start_on"
      .query[(String, String)]
      .to[List]

  /** Native event authoring (no google_event_id until pushed to Google). */
  def createNative(
      ownerId: UUID,
      title: String,
      on: LocalDate,
      category: String,
      propertyId: Option[UUID],
      source: String,
      sourceId: Option[UUID]
  ): ConnectionIO[UUID] =
    sql"""insert into calendar_event_refs (owner_id, title, start_on, category, source, source_id, property_id)
          values ($ownerId, $title, $on, $category, $source, $sourceId, $propertyId) returning id""".query[UUID].unique

  def update(id: UUID, title: String, on: LocalDate, category: String): ConnectionIO[Int] =
    sql"update calendar_event_refs set title = $title, start_on = $on, category = $category where id = $id and deleted_at is null".update.run

  def softDelete(id: UUID): ConnectionIO[Int] =
    sql"update calendar_event_refs set deleted_at = now() where id = $id and deleted_at is null".update.run

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from calendar_event_refs where id = $id and deleted_at is null)".query[Boolean].unique

  /** Source-paired event for (source, source_id) — keeps maintenance/agent events idempotent. */
  def bySource(source: String, sourceId: UUID): ConnectionIO[Option[UUID]] =
    sql"select id from calendar_event_refs where source = $source and source_id = $sourceId and deleted_at is null"
      .query[UUID]
      .option

  /** The merged view: native/Google events in range + read-only overlays from due tasks and maintenance plans. Native =
    * system-of-linkage; tasks/maintenance are derived, not stored.
    */
  def merged(from: LocalDate, to: LocalDate): ConnectionIO[List[CalEvent]] =
    sql"""select id, title, start_on, coalesce(category, 'manual'), source
            from calendar_event_refs where deleted_at is null and start_on between $from and $to
          union all
          select id, title, due_on, 'task', 'task'
            from tasks where due_on between $from and $to and status <> 'done'
          union all
          select id, title, next_due, 'maintenance', 'maintenance'
            from maintenance_plans where next_due between $from and $to and active
          order by 3""".query[CalEvent].to[List]
}
