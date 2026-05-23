package com.kanzen.calendar

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate

/** F07 — calendar event refs synced with Google; idempotent by google_event_id. */
object CalendarRepo {
  def upsert(googleEventId: String, title: String, startOn: LocalDate, source: String): ConnectionIO[Int] =
    sql"""insert into calendar_event_refs (google_event_id, title, start_on, source)
          values ($googleEventId, $title, $startOn, $source)
          on conflict (google_event_id) do update set title = excluded.title, start_on = excluded.start_on""".update.run

  def list: ConnectionIO[List[(String, String)]] =
    sql"select coalesce(google_event_id, ''), title from calendar_event_refs order by start_on".query[(String, String)].to[List]
}
