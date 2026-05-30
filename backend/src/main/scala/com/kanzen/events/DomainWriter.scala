package com.kanzen.events

import cats.syntax.all._
import com.kanzen.audit.AuditRepo
import doobie.ConnectionIO
import io.circe.Json

import java.util.UUID

/** F34 — pairs the audit-log write and the event-outbox emit so the two views of the same truth stay aligned. Every
  * domain mutation that wants to be heard goes through here; future consumers (notifications, GCal sync, Pulsar bridge,
  * mobile push) get the new event for free.
  *
  * Both writes run inside the caller's `ConnectionIO` — same transaction as the domain mutation, so we never get a
  * write without an event or an event without a write.
  *
  * Usage:
  * {{{
  * DomainWriter.write(
  *   actor      = Actor.user(p.userId),
  *   action     = "calendar.create",       // audit verb
  *   eventType  = Events.Calendar.Created, // event-outbox verb
  *   ownerId    = p.userId,
  *   propertyId = req.propertyId
  * )(repo.createNative(...))(
  *   subjectOf  = id => Subject("calendar_event", id),
  *   payloadOf  = id => Json.obj("title" -> req.title.asJson, "on" -> req.on.toString.asJson)
  * )
  * }}}
  */
object DomainWriter {
  def write[A](
      actor: Actor,
      action: String,
      eventType: String,
      ownerId: UUID,
      propertyId: Option[UUID] = None
  )(body: ConnectionIO[A])(
      subjectOf: A => Subject,
      payloadOf: A => Json = (_: A) => Json.obj()
  ): ConnectionIO[A] =
    for {
      a <- body
      subject = subjectOf(a)
      payload = payloadOf(a)
      _ <- AuditRepo
        .write(actor.`type`, actor.id, action, Some(subject.`type`), Some(subject.id), payload, Some(ownerId))
      _ <- EventRepo.emit(Envelope(eventType, actor, subject, ownerId, propertyId, payload))
    } yield a
}
