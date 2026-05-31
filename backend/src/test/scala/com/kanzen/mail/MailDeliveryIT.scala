package com.kanzen.mail

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.Instant
import java.util.UUID

/** F46/SES — the email-delivery worker drains the recorded queue through the EmailTransport seam, marking each
  * delivered (idempotent — a delivered row is terminal), and the repo records a delivery error for retry when the
  * transport fails. Per-recipient assertions keep it parallelism-safe (a delivered row is never re-touched, and the
  * failure path is exercised via the repo directly so it doesn't race a concurrent success-drain).
  */
object MailDeliveryIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def deliveredAt(xa: Transactor[IO], to: String): IO[Option[Instant]] =
    sql"select delivered_at from outbound_emails where to_email = $to order by created_at desc limit 1"
      .query[Option[Instant]].unique.transact(xa)

  test("the worker delivers a recorded email through the seam; a delivered row is terminal (idempotent)") { xa =>
    val to = s"deliver-${UUID.randomUUID()}@x.test"
    for {
      _ <- OutboundEmailRepo.record(None, to, "Hi", "body", "verify_email").transact(xa)
      before <- deliveredAt(xa, to)
      _ <- MailDeliveryWorker.drainOnce(xa, StubEmailTransport)
      after <- deliveredAt(xa, to)
      // a second drain must not re-touch a delivered row → its delivered_at is unchanged
      _ <- MailDeliveryWorker.drainOnce(xa, StubEmailTransport)
      again <- deliveredAt(xa, to)
    } yield expect(before.isEmpty) and expect(after.isDefined) and expect(after == again)
  }

  test("a transport failure is recorded as a delivery error and the row stays undelivered for retry") { xa =>
    val to = s"fail-${UUID.randomUUID()}@x.test"
    val transport: EmailTransport = (_: OutboundEmail) => IO.raiseError(new RuntimeException("SES throttled"))
    for {
      id <- OutboundEmailRepo.record(None, to, "Hi", "body", "verify_email").transact(xa)
      // exercise the failure path directly (the worker's per-row logic) so it doesn't race a concurrent success-drain
      e <- OutboundEmailRepo.undelivered(100).transact(xa).map(_.find(_.id == id).get)
      _ <- transport.deliver(e).attempt.flatMap {
        case Left(err) => OutboundEmailRepo.markDeliveryError(e.id, err.getMessage).transact(xa)
        case Right(_) => IO.pure(0)
      }
      row <- sql"select delivered_at, delivery_error from outbound_emails where id = $id"
        .query[(Option[Instant], Option[String])].unique.transact(xa)
    } yield expect(row._1.isEmpty) and expect(row._2.exists(_.contains("throttled")))
  }
}
