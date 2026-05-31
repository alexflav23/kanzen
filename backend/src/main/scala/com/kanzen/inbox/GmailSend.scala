package com.kanzen.inbox

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.workspace.WorkspaceAuth
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor

import java.util.UUID

/** A queued outbound Gmail dispatch (durable; the worker drains it). */
final case class GmailSendTask(id: UUID, tenantId: UUID, threadId: UUID, messageId: UUID)

object GmailSendQueueRepo {
  /** Enqueue a dispatch for a recorded outbound message (idempotent on message_id; tenant from the thread). */
  def enqueue(threadId: UUID, messageId: UUID): ConnectionIO[Int] =
    sql"""insert into gmail_send_queue (tenant_id, thread_id, message_id)
          values (coalesce((select tenant_id from email_threads where id = $threadId),
                           '7e000000-0000-0000-0000-000000000001'::uuid), $threadId, $messageId)
          on conflict (message_id) do nothing""".update.run

  def pending(limit: Int): ConnectionIO[List[GmailSendTask]] =
    sql"""select id, tenant_id, thread_id, message_id from gmail_send_queue
          where status = 'pending' order by created_at limit $limit""".query[GmailSendTask].to[List]

  def markSent(id: UUID, providerMessageId: String): ConnectionIO[Int] =
    sql"""update gmail_send_queue set status = 'sent', provider_message_id = $providerMessageId,
          attempts = attempts + 1, sent_at = now(), last_error = null where id = $id""".update.run

  def markFailed(id: UUID, err: String): ConnectionIO[Int] =
    sql"update gmail_send_queue set status = 'failed', attempts = attempts + 1, last_error = $err where id = $id".update.run
}

/** W9.4 / F44 — the outbound-Gmail dispatch seam. [[StubGmailSender]] enforces the F44 contract (the tenant must have
  * connected Workspace, or the dispatch fails — exactly as the real Gmail client would) and returns a deterministic
  * stub provider message id, so the whole send pipeline (inbox send → queue → worker → seam) is exercised now; the real
  * `GoogleGmailSender` (service-account token via WorkspaceAuth → `users.messages.send`) drops in behind this trait.
  * The message row is recorded the instant the human hits send (Kanzen never sends without `mail:send`); this is only
  * the *dispatch* to Google.
  */
trait GmailSender {
  def send(tenantId: UUID, threadId: UUID, messageId: UUID): IO[String]
}

final class StubGmailSender(wsAuth: WorkspaceAuth) extends GmailSender {
  def send(tenantId: UUID, threadId: UUID, messageId: UUID): IO[String] =
    wsAuth.tokenFor(tenantId, "gmail-sender@kanzen", List("https://www.googleapis.com/auth/gmail.send"))
      .as(s"stub-gmail:$messageId")
}

/** Drains the outbound-Gmail queue through the [[GmailSender]] seam (StubGmailSender now). Runs alongside the relay in
  * `Main`. Idempotent + at-least-once: a failed dispatch stays out of `sent` for a later retry.
  */
object GmailSendWorker {
  import scala.concurrent.duration._

  def drainOnce(xa: Transactor[IO], sender: GmailSender): IO[Int] =
    GmailSendQueueRepo.pending(100).transact(xa).flatMap { tasks =>
      tasks.traverse_ { t =>
        sender.send(t.tenantId, t.threadId, t.messageId).attempt.flatMap {
          case Right(pid) => GmailSendQueueRepo.markSent(t.id, pid).transact(xa).void
          case Left(e) => GmailSendQueueRepo.markFailed(t.id, e.getMessage).transact(xa).void
        }
      }.as(tasks.size)
    }

  def run(xa: Transactor[IO], sender: GmailSender, every: FiniteDuration = 3.seconds): IO[Unit] =
    (drainOnce(xa, sender).attempt *> IO.sleep(every)).foreverM
}
