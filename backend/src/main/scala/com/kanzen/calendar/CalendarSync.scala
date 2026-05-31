package com.kanzen.calendar

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.workspace.WorkspaceAuth
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor

import java.util.UUID

/** F07 Path B — the operator-configured mapping from a tenant's calendar scope to a Google calendar id. */
final case class CalendarMap(googleCalendarId: String, direction: String)

object WorkspaceCalendarMapRepo {
  def find(tenantId: UUID, scope: String = "all"): ConnectionIO[Option[CalendarMap]] =
    sql"""select google_calendar_id, direction from workspace_calendar_map
          where tenant_id = $tenantId and scope = $scope""".query[CalendarMap].option

  def connect(tenantId: UUID, scope: String, googleCalendarId: String, direction: String, by: UUID): ConnectionIO[Int] =
    sql"""insert into workspace_calendar_map (tenant_id, scope, google_calendar_id, direction, created_by)
          values ($tenantId, $scope, $googleCalendarId, $direction, $by)
          on conflict (tenant_id, scope) do update set
            google_calendar_id = excluded.google_calendar_id, direction = excluded.direction""".update.run
}

/** A queued outbound push (durable; the worker drains it). */
final case class SyncTask(id: UUID, tenantId: UUID, eventId: UUID, op: String)

object CalendarSyncQueueRepo {
  /** Enqueue a push; re-emitting the same (event, op) coalesces (re-arms to pending) rather than duplicating. */
  def enqueue(tenantId: UUID, eventId: UUID, op: String): ConnectionIO[Int] =
    sql"""insert into calendar_sync_queue (tenant_id, event_id, op) values ($tenantId, $eventId, $op)
          on conflict (event_id, op) do update set status = 'pending', last_error = null""".update.run

  def pending(limit: Int): ConnectionIO[List[SyncTask]] =
    sql"""select id, tenant_id, event_id, op from calendar_sync_queue
          where status = 'pending' order by created_at limit $limit""".query[SyncTask].to[List]

  def markSynced(id: UUID, googleEventId: String): ConnectionIO[Int] =
    sql"""update calendar_sync_queue set status = 'synced', google_event_id = $googleEventId,
          attempts = attempts + 1, synced_at = now(), last_error = null where id = $id""".update.run

  def markFailed(id: UUID, err: String): ConnectionIO[Int] =
    sql"""update calendar_sync_queue set status = 'failed', attempts = attempts + 1, last_error = $err
          where id = $id""".update.run
}

/** F07 Path B / F44 — the seam the outbound calendar sync pushes through. [[StubCalendarSync]] enforces the *contract*
  * (the tenant must have connected Workspace — F44 — or the push fails, exactly as the real client would) and returns a
  * deterministic stub Google event id, so the whole pipeline (consumer → queue → worker → seam → google_event_id) is
  * exercised end-to-end now; the real `GoogleCalendarSync` (service-account token via WorkspaceAuth → Calendar API
  * insert/patch/delete, idempotent on google_event_id) drops in behind this trait once the operator connects Workspace.
  */
trait CalendarSync {
  def push(tenantId: UUID, googleCalendarId: String, eventId: UUID, op: String): IO[String]
}

final class StubCalendarSync(wsAuth: WorkspaceAuth) extends CalendarSync {
  def push(tenantId: UUID, googleCalendarId: String, eventId: UUID, op: String): IO[String] =
    // honour the F44 contract: no connected Workspace ⇒ no token ⇒ the push fails (like the real client).
    wsAuth.tokenFor(tenantId, "calendar-sync@kanzen", List("https://www.googleapis.com/auth/calendar"))
      .as(s"stub-gcal:$googleCalendarId:$eventId:$op")
}

/** The IO worker that drains the push queue through the seam. Runs alongside the F34 relay (in-process in sandbox; a
  * separate subscription in prod). Idempotent + at-least-once: a failed push stays out of `synced` for a later retry.
  */
object CalendarSyncWorker {
  import scala.concurrent.duration._

  def drainOnce(xa: Transactor[IO], sync: CalendarSync): IO[Int] =
    CalendarSyncQueueRepo.pending(100).transact(xa).flatMap { tasks =>
      tasks.traverse_ { t =>
        WorkspaceCalendarMapRepo.find(t.tenantId).transact(xa).flatMap {
          case None => CalendarSyncQueueRepo.markFailed(t.id, "no calendar mapping").transact(xa).void
          case Some(m) =>
            sync.push(t.tenantId, m.googleCalendarId, t.eventId, t.op).attempt.flatMap {
              case Right(gid) => CalendarSyncQueueRepo.markSynced(t.id, gid).transact(xa).void
              case Left(e) => CalendarSyncQueueRepo.markFailed(t.id, e.getMessage).transact(xa).void
            }
        }
      }.as(tasks.size)
    }

  def run(xa: Transactor[IO], sync: CalendarSync, every: FiniteDuration = 2.seconds): IO[Unit] =
    (drainOnce(xa, sync).attempt *> IO.sleep(every)).foreverM
}
