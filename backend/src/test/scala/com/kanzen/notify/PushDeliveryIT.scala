package com.kanzen.notify

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.Instant
import java.util.UUID

/** F34/APNs+FCM — the push-delivery worker drains notifications whose channels include 'push' through the PushTransport
  * seam, marking each pushed (terminal/idempotent); a transport failure records the error for retry. The happy + failure
  * paths are ONE sequential test (the worker's drain is global, so a separate "still un-pushed" test would race a
  * concurrent success-drain within the suite).
  */
object PushDeliveryIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val user = UUID.fromString("10000000-0000-0000-0000-000000000001")

  private def insert(xa: Transactor[IO], title: String, channels: String): IO[UUID] =
    sql"""insert into notifications (tenant_id, user_id, owner_id, type, title, channels_sent)
          values ('7e000000-0000-0000-0000-000000000001'::uuid, $user, $user, 'test', $title, $channels::jsonb)
          returning id""".query[UUID].unique.transact(xa)

  private def pushedAt(xa: Transactor[IO], id: UUID): IO[Option[Instant]] =
    sql"select pushed_at from notifications where id = $id".query[Option[Instant]].unique.transact(xa)

  test("the worker pushes a 'push' notification (terminal/idempotent); a transport failure is recorded for retry") { xa =>
    val failing: PushTransport = (_: NotificationRepo.PushPending) => IO.raiseError(new RuntimeException("APNs down"))
    for {
      okId <- insert(xa, s"push-${UUID.randomUUID()}", """["push","in_app"]""")
      before <- pushedAt(xa, okId)
      _ <- PushDeliveryWorker.drainOnce(xa, StubPushTransport)
      after <- pushedAt(xa, okId)
      _ <- PushDeliveryWorker.drainOnce(xa, StubPushTransport) // a pushed row is terminal
      again <- pushedAt(xa, okId)
      // failure path — recorded AFTER the global success-drain, exercised via the per-row logic directly
      failId <- insert(xa, s"pushfail-${UUID.randomUUID()}", """["push"]""")
      n <- NotificationRepo.pendingPush(500).transact(xa).map(_.find(_.id == failId).get)
      _ <- failing.push(n).attempt.flatMap {
        case Left(e) => NotificationRepo.markPushError(n.id, e.getMessage).transact(xa)
        case Right(_) => IO.pure(0)
      }
      failRow <- sql"select pushed_at, push_error from notifications where id = $failId"
        .query[(Option[Instant], Option[String])].unique.transact(xa)
    } yield expect(before.isEmpty) and expect(after.isDefined) and expect(after == again) and
      expect(failRow._1.isEmpty) and expect(failRow._2.exists(_.contains("APNs down")))
  }

  test("a notification WITHOUT a push channel is never picked up by the push worker") { xa =>
    for {
      id <- insert(xa, s"inapp-${UUID.randomUUID()}", """["in_app"]""")
      pending <- NotificationRepo.pendingPush(500).transact(xa)
    } yield expect(!pending.exists(_.id == id)) // in_app-only → not a push delivery
  }
}
