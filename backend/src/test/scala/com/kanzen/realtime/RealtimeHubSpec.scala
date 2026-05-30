package com.kanzen.realtime

import cats.effect.IO
import com.kanzen.events.{Actor, Envelope, EventRepo, Subject}
import io.circe.Json
import weaver.SimpleIOSuite

import java.util.UUID

/** F48 §7 — the in-process realtime hub. Pure fan-out + wire-shape, no DB: every subscriber gets every published row;
  * the wire JSON is the uniform `{eventType, subject, payload}` regardless of how the event was emitted.
  */
object RealtimeHubSpec extends SimpleIOSuite {

  private def row(eventType: String, subjType: String, subjId: UUID, env: Json): EventRepo.OutboxRow =
    EventRepo.OutboxRow(UUID.randomUUID(), eventType, subjType, Some(subjId), env)

  test("push fans out to every subscriber") {
    val tid = UUID.randomUUID()
    val r = row("email_thread.assigned", "email_thread", tid, Json.obj())
    for {
      hub <- RealtimeHub.create
      // subscribeAwait guarantees both subscriptions are live before we publish (no race)
      got <- hub.subscribeAwait().use { a =>
        hub.subscribeAwait().use { b =>
          val collectA = a.take(1).compile.toList
          val collectB = b.take(1).compile.toList
          for {
            fa <- collectA.start
            fb <- collectB.start
            _ <- hub.publish(r)
            ra <- fa.joinWithNever
            rb <- fb.joinWithNever
          } yield (ra, rb)
        }
      }
    } yield expect(got._1.map(_.eventType) == List("email_thread.assigned")) and
      expect(got._2.map(_.eventType) == List("email_thread.assigned")) and
      expect(got._1.head.subjectId.contains(tid))
  }

  pureTest("the wire shape is uniform {eventType, subject, payload}; envelope owner/property are lifted") {
    val owner = UUID.randomUUID()
    val asset = UUID.randomUUID()
    val prop = UUID.randomUUID()
    // an envelope-emitted row: payload is the wrapped envelope
    val env =
      Envelope("asset.created", Actor.user(owner), Subject("asset", asset), owner, Some(prop), Json.obj()).toJson
    val ev = RtEvent.fromRow(row("asset.created", "asset", asset, env))
    val wire = ev.wire
    expect(ev.ownerId.contains(owner)) and
      expect(ev.propertyId.contains(prop)) and
      expect(wire.hcursor.get[String]("eventType").toOption.contains("asset.created")) and
      expect(wire.hcursor.downField("subject").get[String]("type").toOption.contains("asset")) and
      expect(wire.hcursor.downField("subject").get[UUID]("id").toOption.contains(asset))
  }
}
