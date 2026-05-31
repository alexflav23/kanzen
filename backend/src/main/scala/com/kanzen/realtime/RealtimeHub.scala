package com.kanzen.realtime

import cats.effect.{IO, Ref}
import cats.syntax.all._
import com.kanzen.events.EventRepo
import fs2.concurrent.Topic
import io.circe.Json
import io.circe.syntax._

import java.util.UUID
import scala.util.Try

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
    payload: Json,
    seq: Long = 0L // F48 RT.1b — the resume cursor; 0 for synthetic (e.g. presence) events that aren't replayable.
) {
  def wire: Json =
    Json.obj(
      "eventType" -> eventType.asJson,
      "subject" -> Json.obj("type" -> subjectType.asJson, "id" -> subjectId.asJson),
      "seq" -> seq.asJson,
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
      r.payload,
      r.seq
    )
  }
}

/** F48 RT.5 — the realtime transport seam: publish an [[RtEvent]] to all subscribers, and subscribe to a bounded
  * per-connection stream. [[InProcessTransport]] (a single cats-effect [[Topic]] per JVM) runs in the sandbox; the real
  * `PulsarTransport` (a Pulsar topic + per-connection subscription, operator-gated) drops in behind this trait with the
  * **identical [[RtEvent]] wire shape** end-to-end — so the websocket layer, authz filter and resume cursor are
  * unchanged.
  */
trait RtTransport {
  def publish(ev: RtEvent): IO[Unit]
  def subscribe(maxQueued: Int): fs2.Stream[IO, RtEvent]
  def subscribeAwait(maxQueued: Int): cats.effect.Resource[IO, fs2.Stream[IO, RtEvent]]
}

/** Sandbox transport: a single in-process fs2 [[Topic]]. A slow subscriber that overflows its buffer drops the oldest
  * events (the client reconnects with `since` and replays from the durable outbox — RT.1b).
  */
final class InProcessTransport(topic: Topic[IO, RtEvent]) extends RtTransport {
  def publish(ev: RtEvent): IO[Unit] = topic.publish1(ev).void
  def subscribe(maxQueued: Int): fs2.Stream[IO, RtEvent] = topic.subscribe(maxQueued)
  def subscribeAwait(maxQueued: Int): cats.effect.Resource[IO, fs2.Stream[IO, RtEvent]] =
    topic.subscribeAwait(maxQueued)
}

object InProcessTransport {
  def create: IO[InProcessTransport] = Topic[IO, RtEvent].map(new InProcessTransport(_))
}

/** F48 — the realtime fan-out. The Relay publishes every drained outbox row here (best-effort, after the durable
  * commit) and each websocket connection subscribes to a bounded per-connection stream, all over a swappable
  * [[RtTransport]] (in-process now, Pulsar in prod — W10-RT.5).
  */
final class RealtimeHub(transport: RtTransport, presence: Ref[IO, Map[String, Map[UUID, Int]]]) {

  /** Producer side — called from the Relay sink with each freshly-published outbox row. */
  def publish(row: EventRepo.OutboxRow): IO[Unit] = transport.publish(RtEvent.fromRow(row))

  // ── F48 RT.3 presence ──────────────────────────────────────────────────────
  // entityKey → (userId → how many of that user's connections are viewing). A refcount handles multiple tabs and
  // guarantees "leave" only drops the user once their last tab navigates away / disconnects.
  private def key(entityType: String, entityId: String) = s"$entityType:$entityId"

  private def publishPresence(entityType: String, entityId: String, viewers: Set[UUID]): IO[Unit] =
    transport.publish(
      RtEvent(
        "presence.snapshot",
        entityType,
        Try(UUID.fromString(entityId)).toOption,
        None,
        None,
        Json.obj("userIds" -> viewers.toList.map(_.toString).asJson)
      )
    )

  /** A connection starts viewing an entity → bump the refcount + broadcast the new viewer set (authz-filtered
    * downstream like any event, so presence never leaks to someone who can't read the entity).
    */
  def enter(entityType: String, entityId: String, userId: UUID): IO[Unit] =
    presence
      .modify { m =>
        val k = key(entityType, entityId)
        val inner = m.getOrElse(k, Map.empty).updatedWith(userId)(c => Some(c.getOrElse(0) + 1))
        (m.updated(k, inner), inner.keySet)
      }
      .flatMap(publishPresence(entityType, entityId, _))

  /** A connection stops viewing (navigated away or disconnected) → decrement; drop the user when their last tab leaves.
    */
  def leave(entityType: String, entityId: String, userId: UUID): IO[Unit] =
    presence
      .modify { m =>
        val k = key(entityType, entityId)
        val inner0 = m.getOrElse(k, Map.empty)
        val inner = inner0.updatedWith(userId)(_.map(_ - 1).filter(_ > 0))
        val m2 = if (inner.isEmpty) m - k else m.updated(k, inner)
        (m2, inner.keySet)
      }
      .flatMap(publishPresence(entityType, entityId, _))

  /** Consumer side — a bounded subscription. If a slow client overflows the buffer the oldest events are dropped (the
    * client reconnects with `since` and replays from the durable outbox).
    */
  def subscribe(maxQueued: Int = 256): fs2.Stream[IO, RtEvent] = transport.subscribe(maxQueued)

  /** Like [[subscribe]] but the `Resource` guarantees the subscription is registered before it's handed back — so a
    * publish that races a subscribe can't be missed (used in tests + any synchronous wait-for-event flow).
    */
  def subscribeAwait(maxQueued: Int = 256): cats.effect.Resource[IO, fs2.Stream[IO, RtEvent]] =
    transport.subscribeAwait(maxQueued)
}

object RealtimeHub {

  /** Build a hub over the in-process transport (sandbox). Prod swaps `InProcessTransport.create` for the Pulsar one. */
  def create: IO[RealtimeHub] =
    for {
      transport <- InProcessTransport.create
      presence <- Ref[IO].of(Map.empty[String, Map[UUID, Int]])
    } yield new RealtimeHub(transport, presence)
}
