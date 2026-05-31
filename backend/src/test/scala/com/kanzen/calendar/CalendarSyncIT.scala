package com.kanzen.calendar

import cats.effect.IO
import com.kanzen.db.TestDb
import com.kanzen.events.EventRepo
import com.kanzen.workspace.{StubWorkspaceAuth, WorkspaceRepo}
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F07 Path B — the outbound Google-Calendar push substrate: consumer (enqueue only when the tenant connected a
  * calendar) → durable queue → IO worker → the CalendarSync seam (which honours the F44 "Workspace connected" contract).
  * Fresh tenants + per-event-id assertions keep it parallelism-safe on the shared test DB.
  */
object CalendarSyncIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val admin = UUID.fromString("10000000-0000-0000-0000-000000000001")

  private def freshTenant(xa: Transactor[IO]): IO[UUID] =
    sql"insert into tenants (slug, name) values (${"cs-" + UUID.randomUUID()}, 'CalSync') returning id"
      .query[UUID].unique.transact(xa)

  private def freshEvent(xa: Transactor[IO], tenantId: UUID): IO[UUID] =
    sql"""insert into calendar_event_refs (owner_id, tenant_id, title, start_on, category, source)
          values ($admin, $tenantId, 'Sync me', current_date, 'booking', 'manual') returning id"""
      .query[UUID].unique.transact(xa)

  private def outbox(eventType: String, eventId: UUID): EventRepo.OutboxRow =
    EventRepo.OutboxRow(UUID.randomUUID(), eventType, "calendar_event", Some(eventId), Json.obj(), 0L)

  private def queueStatus(xa: Transactor[IO], eventId: UUID): IO[Option[(String, Option[String])]] =
    sql"select status, google_event_id from calendar_sync_queue where event_id = $eventId"
      .query[(String, Option[String])].option.transact(xa)

  private def connectWorkspace(xa: Transactor[IO], t: UUID): IO[Unit] =
    WorkspaceRepo.connect(t, "kanzen.local", "sa@x.iam.gserviceaccount.com", s"dev:$t", List("cal"), admin).transact(xa).void

  test("the consumer enqueues a push only once the tenant has connected a calendar") { xa =>
    for {
      t <- freshTenant(xa)
      eid <- freshEvent(xa, t)
      // no mapping yet → the consumer does nothing
      _ <- CalendarSyncConsumer.handle(outbox("calendar_event.created", eid)).transact(xa)
      before <- queueStatus(xa, eid)
      // operator connects a Google calendar for this tenant
      _ <- WorkspaceCalendarMapRepo.connect(t, "all", "primary@group.calendar.google.com", "push", admin).transact(xa)
      _ <- CalendarSyncConsumer.handle(outbox("calendar_event.updated", eid)).transact(xa)
      after <- queueStatus(xa, eid)
    } yield expect(before.isEmpty) and expect(after.isDefined)
  }

  test("the worker pushes a queued event through the seam and records the Google event id (Workspace connected)") { xa =>
    val sync = new StubCalendarSync(new StubWorkspaceAuth(xa))
    for {
      t <- freshTenant(xa)
      eid <- freshEvent(xa, t)
      _ <- connectWorkspace(xa, t)
      _ <- WorkspaceCalendarMapRepo.connect(t, "all", "primary@group.calendar.google.com", "push", admin).transact(xa)
      _ <- CalendarSyncQueueRepo.enqueue(t, eid, "create").transact(xa)
      _ <- CalendarSyncWorker.drainOnce(xa, sync)
      st <- queueStatus(xa, eid)
    } yield expect(st.exists(_._1 == "synced")) and expect(st.exists(_._2.exists(_.startsWith("stub-gcal:"))))
  }

  test("the worker fails the push when the tenant hasn't connected Workspace (the F44 contract holds)") { xa =>
    val sync = new StubCalendarSync(new StubWorkspaceAuth(xa))
    for {
      t <- freshTenant(xa)
      eid <- freshEvent(xa, t)
      // a calendar mapping but NO Workspace connection → no service-account token → the push fails
      _ <- WorkspaceCalendarMapRepo.connect(t, "all", "primary@group.calendar.google.com", "push", admin).transact(xa)
      _ <- CalendarSyncQueueRepo.enqueue(t, eid, "create").transact(xa)
      _ <- CalendarSyncWorker.drainOnce(xa, sync)
      st <- queueStatus(xa, eid)
    } yield expect(st.exists(_._1 == "failed")) and expect(st.exists(_._2.isEmpty))
  }
}
