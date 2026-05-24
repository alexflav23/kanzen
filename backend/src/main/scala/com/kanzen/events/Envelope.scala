package com.kanzen.events

import io.circe.Json
import io.circe.syntax._

import java.util.UUID

/** F34 — who caused the event (a user, or `system`/`agent`). */
final case class Actor(`type`: String, id: Option[UUID])
object Actor {
  def user(id: UUID): Actor = Actor("user", Some(id))
  val system: Actor         = Actor("system", None)
}

/** F34 — the aggregate the event is about (task, product, bill, asset, …). */
final case class Subject(`type`: String, id: UUID)

/** F34 — the unified, schema-versioned domain-event envelope. Serialised into
  * `event_outbox.payload`; every producer emits this shape so any consumer can react
  * without bespoke wiring. `owner_id`/`property_id` let consumers honour F02 at delivery. */
final case class Envelope(
    eventType: String,
    actor: Actor,
    subject: Subject,
    ownerId: UUID,
    propertyId: Option[UUID],
    payload: Json = Json.obj(),
    schemaVersion: Int = 1,
) {
  def toJson: Json = Json.obj(
    "type"           -> eventType.asJson,
    "actor"          -> Json.obj("type" -> actor.`type`.asJson, "id" -> actor.id.asJson),
    "subject"        -> Json.obj("type" -> subject.`type`.asJson, "id" -> subject.id.asJson),
    "owner_id"       -> ownerId.asJson,
    "property_id"    -> propertyId.asJson,
    "payload"        -> payload,
    "schema_version" -> schemaVersion.asJson,
  )
}
