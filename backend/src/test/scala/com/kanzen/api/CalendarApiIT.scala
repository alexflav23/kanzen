package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Calendar._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.{LocalDate, LocalTime}
import java.util.UUID

/** F07 — native event authoring + a merged view overlaying read-only task & maintenance dates; Staff read but cannot
  * author.
  */
object CalendarApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")
  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private val today = LocalDate.now()

  test("create → appears in merged view → update → delete") { xa =>
    for {
      created <- Calendar
        .create(xa, lorna, CreateReq("Plumber visit", today, Some("maintenance"), None, None, None))
        .map(_.toOption.get)
      after <- Calendar.events(xa, lorna, today.minusDays(1), today.plusDays(1), None).map(_.toOption.get)
      _ <- Calendar
        .update(xa, lorna, created.id, UpdateReq("Plumber visit (AM)", today, "maintenance", None, None))
        .map(_.toOption.get)
      _ <- Calendar.delete(xa, lorna, created.id).map(_.toOption.get)
      gone <- Calendar.events(xa, lorna, today.minusDays(1), today.plusDays(1), None).map(_.toOption.get)
    } yield expect(!created.readOnly) and
      expect(after.exists(e => e.id == created.id && e.title == "Plumber visit")) and
      expect(!gone.exists(_.id == created.id))
  }

  test("merged view overlays read-only task due-dates (F06)") { xa =>
    for {
      _ <-
        sql"insert into tasks (tenant_id, owner_id, title, status, due_on) values ('7e000000-0000-0000-0000-000000000001'::uuid, $owner, 'Overlay task', 'todo', $today)".update.run
          .transact(xa)
      view <- Calendar.events(xa, lorna, today.minusDays(1), today.plusDays(1), None).map(_.toOption.get)
      task = view.find(e => e.source == "task" && e.title == "Overlay task")
    } yield expect(task.isDefined) and expect(task.exists(_.readOnly)) // overlays are read-only
  }

  test("category filter narrows the merged view") { xa =>
    for {
      _ <- Calendar
        .create(xa, lorna, CreateReq("Booking only", today, Some("booking"), None, None, None))
        .map(_.toOption.get)
      booked <- Calendar.events(xa, lorna, today.minusDays(1), today.plusDays(1), Some("booking")).map(_.toOption.get)
    } yield expect(booked.nonEmpty) and expect(booked.forall(_.category == "booking"))
  }

  test("Staff can read the calendar but cannot author events (403)") { xa =>
    for {
      canRead <- Calendar.events(xa, marcia, today.minusDays(1), today.plusDays(1), None)
      cannotAdd <- Calendar.create(xa, marcia, CreateReq("Staff event", today, None, None, None, None))
    } yield expect(canRead.isRight) and expect(cannotAdd.left.exists(_._1.code == 403))
  }

  test("W6.5 — a timed event round-trips its property-local time; overlays stay all-day") { xa =>
    for {
      created <- Calendar
        .create(
          xa,
          lorna,
          CreateReq(
            "Window cleaners",
            today,
            Some("booking"),
            None,
            Some(LocalTime.of(9, 30)),
            Some(LocalTime.of(11, 0))
          )
        )
        .map(_.toOption.get)
      view <- Calendar.events(xa, lorna, today.minusDays(1), today.plusDays(1), None).map(_.toOption.get)
      timed = view.find(_.id == created.id)
      task = view.find(_.source == "task")
    } yield expect(created.startTime.contains(LocalTime.of(9, 30))) and
      expect(timed.exists(_.startTime.contains(LocalTime.of(9, 30)))) and
      expect(timed.exists(_.endTime.contains(LocalTime.of(11, 0)))) and
      expect(task.forall(_.startTime.isEmpty)) // task/maintenance overlays are all-day
  }

  // F34 — the bar that prevents drift on the Calendar domain. Every domain mutation must emit. If a future calendar
  // write skips DomainWriter, this test fails. Adding new mutation kinds → extend the expected event-type set here.
  test("F34 — calendar mutations emit `calendar_event.{created,updated,deleted}`") { xa =>
    for {
      created <- Calendar
        .create(xa, lorna, CreateReq("Emission canary", today.plusDays(2), Some("booking"), None, None, None))
        .map(_.toOption.get)
      _ <- Calendar
        .update(xa, lorna, created.id, UpdateReq("Emission canary v2", today.plusDays(2), "booking", None, None))
        .map(_.toOption.get)
      _ <- Calendar.delete(xa, lorna, created.id).map(_.toOption.get)
      types <- sql"""select event_type from event_outbox
                     where aggregate_type = 'calendar_event' and aggregate_id = ${created.id}
                     order by created_at"""
        .query[String]
        .to[List]
        .transact(xa)
    } yield expect(types == List("calendar_event.created", "calendar_event.updated", "calendar_event.deleted"))
  }
}
