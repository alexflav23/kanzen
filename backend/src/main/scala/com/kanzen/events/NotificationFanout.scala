package com.kanzen.events

import cats.syntax.all._
import com.kanzen.authz.{Authz, Authorizer}
import com.kanzen.notify.{NotificationRepo, Subscription, SubscriptionRepo}
import doobie.ConnectionIO
import io.circe.Json

import java.util.UUID

/** F34 — fans a domain event out to in-app notifications (+ push/email channels, mocked in
  * sandbox) for every matching subscription, **honouring F02 at delivery** (AC5): a recipient
  * is never told about a subject they cannot read. The fan-out is idempotent (dedup by
  * event+user), so redelivery never double-notifies. */
object NotificationFanout extends Consumer {
  val name = "NotificationFanout"

  /** The F02 resource a recipient must be able to read to be told about this event.
    * `None` ⇒ a platform event with no subject gate (everyone subscribed may receive it). */
  private def gateResource(eventType: String): Option[String] =
    eventType.takeWhile(_ != '.') match {
      case "bill" | "expense" | "reconciliation" | "ledger" | "payment" | "bank" => Some("bill") // finance family — Staff have none
      case "asset"                                                               => Some("asset")
      case "product"                                                             => Some("product")
      case "task"                                                                => Some("task")
      case _                                                                     => None
    }

  private def title(eventType: String): String = eventType match {
    case "task.completed"        => "Task completed"
    case "task.assigned"         => "Task assigned to you"
    case "task.comment.added"    => "New comment on a task"
    case "product.out_of_stock"  => "A product has run out"
    case "product.low"           => "A product is running low"
    case "bill.variance_flagged" => "A bill is outside its expected range"
    case other                   => other
  }

  def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit] = {
    val c        = evt.payload.hcursor
    val ownerId  = c.get[UUID]("owner_id").toOption
    val subjType = c.downField("subject").get[String]("type").toOption
    val subjId   = c.downField("subject").get[UUID]("id").toOption
    val gate     = gateResource(evt.eventType)

    ownerId match {
      case None => ().pure[ConnectionIO] // not a unified envelope (low-level emit) — nothing to fan out
      case Some(owner) =>
        for {
          subs   <- SubscriptionRepo.matching(evt.eventType)
          // resolve each distinct role's authorizer once
          byRole <- subs.map(_.role).distinct.traverse(r => Authz.authorizer(r).map(r -> _)).map(_.toMap)
          _      <- subs.traverse_(s => fanOne(evt, owner, subjType, subjId, gate, s, byRole))
        } yield ()
    }
  }

  private def fanOne(
      evt: EventRepo.OutboxRow,
      owner: UUID,
      subjType: Option[String],
      subjId: Option[UUID],
      gate: Option[String],
      s: Subscription,
      byRole: Map[String, Authorizer],
  ): ConnectionIO[Unit] = {
    val visible = gate.forall(res => byRole.get(s.role).exists(_.canRead(res)))
    if (!visible) ().pure[ConnectionIO] // F02: recipient can't see the subject → no notification (AC5)
    else
      NotificationRepo
        .insert(s.userId, owner, evt.id, evt.eventType, title(evt.eventType), None, subjType, subjId, s.channels)
        .void // channels recorded; real APNs/FCM/SES delivery is infra (deferred)
  }
}

/** The standard sandbox consumer set wired into the relay (more land with their features:
  * SearchIndexer F28, LedgerPoster F18, ReminderScheduler F11). */
object Consumers {
  val sandbox: List[Consumer] = List(NotificationFanout)
}
