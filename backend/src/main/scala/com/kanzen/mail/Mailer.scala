package com.kanzen.mail

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.s3.BlobToken
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor

import java.time.Instant
import java.util.UUID
import scala.util.Try

/** One outbound email as recorded in the sandbox (the StubMailer sink). */
final case class OutboundEmail(
    id: UUID,
    tenantId: Option[UUID],
    toEmail: String,
    subject: String,
    body: String,
    kind: String,
    createdAt: Instant
)

object OutboundEmailRepo {
  private val cols = fr"id, tenant_id, to_email, subject, body, kind, created_at"

  def record(
      tenantId: Option[UUID],
      to: String,
      subject: String,
      body: String,
      kind: String
  ): ConnectionIO[UUID] =
    sql"""insert into outbound_emails (tenant_id, to_email, subject, body, kind)
          values ($tenantId, $to, $subject, $body, $kind) returning id""".query[UUID].unique

  /** The most-recent recorded emails (dev outbox viewer); optionally filtered to a recipient. */
  def recent(to: Option[String], limit: Int): ConnectionIO[List[OutboundEmail]] = {
    val where = to.fold(Fragment.empty)(t => fr"where to_email = $t")
    (fr"select" ++ cols ++ fr"from outbound_emails" ++ where ++ fr"order by created_at desc limit $limit")
      .query[OutboundEmail]
      .to[List]
  }

  // ── F46/SES delivery queue ───────────────────────────────────────────────────
  def undelivered(limit: Int): ConnectionIO[List[OutboundEmail]] =
    (fr"select" ++ cols ++ fr"from outbound_emails where delivered_at is null order by created_at limit $limit")
      .query[OutboundEmail]
      .to[List]

  def markDelivered(id: UUID): ConnectionIO[Int] =
    sql"update outbound_emails set delivered_at = now(), attempts = attempts + 1, delivery_error = null where id = $id".update.run

  def markDeliveryError(id: UUID, err: String): ConnectionIO[Int] =
    sql"update outbound_emails set attempts = attempts + 1, delivery_error = $err where id = $id".update.run
}

/** F46/SES — the platform mail seam: verification magic-links, notifications, digests all send through this one
  * interface. [[StubMailer]] records every message in `outbound_emails` (the dev environment reads it back to complete
  * flows without a live SES); the real `SesMailer` swaps in behind this trait once the operator verifies the SES domain
  * — every producer is already wired correctly, so that's a drop-in. (Mirrors the
  * [[com.kanzen.workspace.WorkspaceAuth]] stub-seam pattern.)
  */
trait Mailer {
  def send(tenantId: Option[UUID], to: String, subject: String, body: String, kind: String): IO[Unit]
}

final class StubMailer(xa: Transactor[IO]) extends Mailer {
  def send(tenantId: Option[UUID], to: String, subject: String, body: String, kind: String): IO[Unit] =
    OutboundEmailRepo.record(tenantId, to, subject, body, kind).transact(xa).void
}

/** F46/SES — the actual *delivery* seam (distinct from recording): hands a recorded email to the transport. The
  * [[StubEmailTransport]] is a no-op success (the sandbox treats "recorded" as "delivered"); the real
  * `SesEmailTransport` calls SES once the operator verifies the domain. A [[MailDeliveryWorker]] drains the undelivered
  * queue through it.
  */
trait EmailTransport {
  def deliver(email: OutboundEmail): IO[Unit]
}

object StubEmailTransport extends EmailTransport {
  def deliver(email: OutboundEmail): IO[Unit] = IO.unit // sandbox: recording IS delivery; SES swaps in here
}

/** Drains the undelivered `outbound_emails` queue through the [[EmailTransport]] seam, marking each delivered (or
  * recording the delivery error for retry). Idempotent + at-least-once. Runs alongside the relay in `Main`.
  */
object MailDeliveryWorker {
  import scala.concurrent.duration._

  def drainOnce(xa: Transactor[IO], transport: EmailTransport): IO[Int] =
    OutboundEmailRepo.undelivered(100).transact(xa).flatMap { pending =>
      pending
        .traverse_ { e =>
          transport.deliver(e).attempt.flatMap {
            case Right(_) => OutboundEmailRepo.markDelivered(e.id).transact(xa).void
            case Left(err) => OutboundEmailRepo.markDeliveryError(e.id, err.getMessage).transact(xa).void
          }
        }
        .as(pending.size)
    }

  def run(xa: Transactor[IO], transport: EmailTransport, every: FiniteDuration = 5.seconds): IO[Unit] =
    (drainOnce(xa, transport).attempt *> IO.sleep(every)).foreverM
}

/** F46 — the email-verification magic-link capability token (HMAC-SHA256, the same primitive as the blob/feed
  * capability URLs). Encodes `tenantId:userId`; verifying it advances the tenant's `verify_email` onboarding step.
  * 7-day TTL.
  */
object VerifyToken {
  private val prefix = "verify"
  private val ttlSeconds = 7L * 24 * 3600

  def mint(tenantId: UUID, userId: UUID, secret: String, nowEpochSec: Long): String =
    BlobToken.sign(s"$prefix:$tenantId:$userId", nowEpochSec + ttlSeconds, secret)

  def parse(token: String, secret: String, nowEpochSec: Long): Option[(UUID, UUID)] =
    BlobToken.verify(token, secret, nowEpochSec).flatMap { key =>
      key.split(":", 3) match {
        case Array(`prefix`, t, u) => Try((UUID.fromString(t), UUID.fromString(u))).toOption
        case _ => None
      }
    }
}
