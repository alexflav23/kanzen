package com.kanzen.calendar

import cats.syntax.all._
import com.kanzen.events.{Consumer, EventRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F07 Path B — turns every `calendar_event.{created,updated,deleted}` into a durable outbound push, but only for a
  * tenant that has connected a Google calendar (a `workspace_calendar_map`). Runs in the relay tx (ConnectionIO),
  * idempotent: re-emitting the same (event, op) coalesces. The actual Google call is the IO [[CalendarSyncWorker]].
  */
object CalendarSyncConsumer extends Consumer {
  val name = "CalendarSyncConsumer"

  private val ops = Map(
    "calendar_event.created" -> "create",
    "calendar_event.updated" -> "update",
    "calendar_event.deleted" -> "delete"
  )

  def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit] =
    ops.get(evt.eventType) match {
      case None => ().pure[ConnectionIO]
      case Some(op) =>
        evt.aggregateId match {
          case None => ().pure[ConnectionIO]
          case Some(eventId) =>
            // resolve the event's tenant, then enqueue only if that tenant has a calendar mapping (no spam otherwise).
            sql"select tenant_id from calendar_event_refs where id = $eventId".query[UUID].option.flatMap {
              case None => ().pure[ConnectionIO]
              case Some(tenantId) =>
                WorkspaceCalendarMapRepo.find(tenantId).flatMap {
                  case None => ().pure[ConnectionIO] // tenant hasn't connected a calendar → nothing to push
                  case Some(_) => CalendarSyncQueueRepo.enqueue(tenantId, eventId, op).void
                }
            }
        }
    }
}
