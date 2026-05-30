package com.kanzen.realtime

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.authz.Authorizer
import com.kanzen.inbox.CollabInboxRepo
import com.kanzen.people.AssigneeScope
import doobie.implicits._
import doobie.util.transactor.Transactor

/** F48 §3.4 — every realtime push is authz-filtered, server-side, before it leaves the JVM. A dropped event is silent
  * (no "you were denied an event" probe — that would itself leak existence).
  *
  * The filter maps a `subject.type` to the resource the viewer must be able to read, then applies any resource-specific
  * scope. Finance/registry/wealth are Principal-private (the carve-out), so a Staff socket never receives those. For
  * `email_thread` the mailbox-visibility tier + per-thread scope (W9.4 RBAC) is enforced exactly as the REST path does,
  * so a hidden-mailbox thread can't leak over the socket either.
  *
  * Unmapped subject types (generic/low-sensitivity, e.g. notifications) pass the resource gate — the email_thread
  * special case still applies where relevant.
  */
object RealtimeFilter {

  /** subject.type → the authz resource the viewer must be able to read. */
  private val resourceOf: Map[String, String] = Map(
    "asset" -> "asset",
    "expense" -> "expense",
    "bill" -> "bill",
    "payment" -> "bill",
    "calendar_event" -> "calendar",
    "task" -> "task",
    "email_thread" -> "inbox",
    "property" -> "property",
    "wealth_account" -> "wealth",
    "document" -> "document",
    "person" -> "person",
    "vendor" -> "vendor"
  )

  def visible(
      ev: RtEvent,
      p: Principal,
      authz: Authorizer,
      scope: Option[AssigneeScope],
      xa: Transactor[IO]
  ): IO[Boolean] = {
    val resourceGate = resourceOf.get(ev.subjectType).forall(authz.canRead(_))
    if (!resourceGate) IO.pure(false)
    else
      ev.subjectType match {
        // The inbox carries a mailbox-visibility tier + per-thread scope on top of the resource gate.
        case "email_thread" =>
          ev.subjectId.fold(IO.pure(true))(tid => CollabInboxRepo.visible(tid, p.tenantId, scope, p.role).transact(xa))
        case _ => IO.pure(true)
      }
  }
}
