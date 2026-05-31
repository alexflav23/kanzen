package com.kanzen.inbox

import cats.effect.IO
import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** One inbound email pulled from the source (a Gmail thread, in the live world). */
final case class InboundEmail(
    providerThreadId: String,
    fromName: String,
    fromAddr: String,
    subject: String,
    snippet: String,
    bodyText: String
)

/** W9.1 / F25 — the inbound-mail seam: pull new messages for a mailbox. [[StubEmailSource]] returns a deterministic,
  * idempotent set so the sandbox can exercise "Sync inbox" → thread appears → agent ingests, without a live Gmail; the
  * real `GmailWatcher` (history API + Pub/Sub) drops in behind the trait. Idempotency rides `provider_thread_id`.
  */
trait EmailSource {
  def fetch(inboxId: UUID, inboxAddress: String): IO[List[InboundEmail]]
}

object StubEmailSource extends EmailSource {
  def fetch(inboxId: UUID, inboxAddress: String): IO[List[InboundEmail]] =
    IO.pure(
      List(
        InboundEmail(s"gmt-$inboxId-1", "Ocado", "orders@ocado.com", "Your delivery is on its way",
          "Arriving tomorrow 08:00–09:00 — 32 items", "Hi, your Ocado order is out for delivery…"),
        InboundEmail(s"gmt-$inboxId-2", "Stratstone Land Rover", "service@stratstone.com", "Range Rover — service due",
          "Your vehicle is due its annual service", "Dear customer, our records show your Range Rover is due…"),
        InboundEmail(s"gmt-$inboxId-3", "Thames Water", "billing@thameswater.co.uk", "Your latest bill",
          "£120.00 due 15 June by Direct Debit", "Your latest statement is ready to view…")
      )
    )
}

object InboxIngestRepo {

  /** Insert a fetched thread (+ its inbound message), idempotent on (inbox_id, provider_thread_id). Returns the new
    * thread id, or None if the thread already existed (re-sync no-op). tenant/owner inherited from the mailbox.
    */
  def ingestThread(inboxId: UUID, e: InboundEmail): ConnectionIO[Option[UUID]] =
    sql"""insert into email_threads (tenant_id, owner_id, inbox_id, subject, snippet, from_name, provider_thread_id, unread)
          select i.tenant_id, i.owner_id, i.id, ${e.subject}, ${e.snippet}, ${e.fromName}, ${e.providerThreadId}, true
          from mail_inboxes i where i.id = $inboxId
          on conflict (inbox_id, provider_thread_id) where provider_thread_id is not null do nothing
          returning id""".query[UUID].option.flatMap {
      case None => Option.empty[UUID].pure[ConnectionIO]
      case Some(threadId) =>
        sql"""insert into email_messages (tenant_id, owner_id, thread_id, direction, from_addr, subject, body_text)
              select i.tenant_id, i.owner_id, $threadId, 'inbound', ${e.fromAddr}, ${e.subject}, ${e.bodyText}
              from mail_inboxes i where i.id = $inboxId""".update.run.as(Some(threadId))
    }
}
