package com.kanzen.realtime

import cats.effect.IO
import com.kanzen.events.EventRepo
import fs2.concurrent.Topic
import io.circe.Json
import io.circe.syntax._

import java.util.UUID

/** F48 — one realtime event, derived from an [[EventRepo.OutboxRow]]. The wire shape sent to the browser is uniform
  * regardless of how the event was emitted (envelope-wrapped or legacy-flat): `{eventType, subject:{type,id},
  * payload}`. The client matches on `eventType` + `subject` to invalidate the right TanStack Query keys.
  *
  * `ownerId`/`propertyId` are lifted out of the envelope payload (when present) so the per-connection authz filter can
  * scope without re-reading the DB for the common case.
  */
final case class RtEvent(
    eventType: String,
    subjectType: String,
    subjectId: Option[UUID],
    ownerId: Option[UUID],
    propertyId: Option[UUID],
    payload: Json
) {
  def wire: Json =
    Json.obj(
      "eventType" -> eventType.asJson,
      "subject" -> Json.obj("type" -> subjectType.asJson, "id" -> subjectId.asJson),
      "payload" -> payload
    )
}

object RtEvent {
  def fromRow(r: EventRepo.OutboxRow): RtEvent = {
    val c = r.payload.hcursor
    RtEvent(
      r.eventType,
      r.aggregateType,
      r.aggregateId,
      c.get[UUID]("owner_id").toOption,
      c.get[UUID]("property_id").toOption,
      r.payload
    )
  }
}

/** F48 — the in-process realtime fan-out. A single cats-effect [[Topic]] per JVM; the Relay publishes every drained
  * outbox row here (best-effort, after the durable commit), and each websocket connection subscribes to a bounded
  * per-connection stream. In production the in-process Topic is swapped for a Pulsar subscription (W10-RT.5,
  * operator-gated) — the [[RtEvent]] wire shape is identical end-to-end.
  */
final class RealtimeHub(topic: Topic[IO, RtEvent]) {

  /** Producer side — called from the Relay sink with each freshly-published outbox row. */
  def publish(row: EventRepo.OutboxRow): IO[Unit] = topic.publish1(RtEvent.fromRow(row)).void

  /** Consumer side — a bounded subscription. If a slow client overflows the buffer the oldest events are dropped (the
    * client reconnects with `since` and replays from the durable outbox).
    */
  def subscribe(maxQueued: Int = 256): fs2.Stream[IO, RtEvent] = topic.subscribe(maxQueued)

  /** Like [[subscribe]] but the `Resource` guarantees the subscription is registered before it's handed back — so a
    * publish that races a subscribe can't be missed (used in tests + any synchronous wait-for-event flow).
    */
  def subscribeAwait(maxQueued: Int = 256): cats.effect.Resource[IO, fs2.Stream[IO, RtEvent]] =
    topic.subscribeAwait(maxQueued)
}

object RealtimeHub {
  def create: IO[RealtimeHub] = Topic[IO, RtEvent].map(new RealtimeHub(_))
}
