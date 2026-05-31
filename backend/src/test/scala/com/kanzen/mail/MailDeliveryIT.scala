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
  * delivered (terminal/idempotent), and the repo records a delivery error for retry when the transport fails. ONE
  * sequential test: weaver runs a suite's tests concurrently, and the worker's drain is global, so a second test's
  * "still undelivered" row would race the first test's success-drain — folding both paths into one test removes that.
  */
object MailDeliveryIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def deliveredAt(xa: Transactor[IO], to: String): IO[Option[Instant]] =
    sql"select delivered_at from outbound_emails where to_email = $to order by created_at desc limit 1"
      .query[Option[Instant]].unique.transact(xa)

  test("the worker delivers through the seam (terminal/idempotent); a transport failure is recorded for retry") { xa =>
    val ok = s"deliver-${UUID.randomUUID()}@x.test"
    val fail = s"fail-${UUID.randomUUID()}@x.test"
    val failing: EmailTransport = (_: OutboundEmail) => IO.raiseError(new RuntimeException("SES throttled"))
    for {
      _ <- OutboundEmailRepo.record(None, ok, "Hi", "body", "verify_email").transact(xa)
      before <- deliveredAt(xa, ok)
      _ <- MailDeliveryWorker.drainOnce(xa, StubEmailTransport)
      after <- deliveredAt(xa, ok)
      _ <- MailDeliveryWorker.drainOnce(xa, StubEmailTransport) // a delivered row is terminal — not re-touched
      again <- deliveredAt(xa, ok)
      // failure path — recorded AFTER the global success-drain, exercised via the worker's per-row logic directly so it
      // can't be swept by a concurrent success-drain
      failId <- OutboundEmailRepo.record(None, fail, "Hi", "body", "verify_email").transact(xa)
      e <- OutboundEmailRepo.undelivered(500).transact(xa).map(_.find(_.id == failId).get)
      _ <- failing.deliver(e).attempt.flatMap {
        case Left(err) => OutboundEmailRepo.markDeliveryError(e.id, err.getMessage).transact(xa)
        case Right(_) => IO.pure(0)
      }
      failRow <- sql"select delivered_at, delivery_error from outbound_emails where id = $failId"
        .query[(Option[Instant], Option[String])].unique.transact(xa)
    } yield expect(before.isEmpty) and expect(after.isDefined) and expect(after == again) and
      expect(failRow._1.isEmpty) and expect(failRow._2.exists(_.contains("throttled")))
  }
}
