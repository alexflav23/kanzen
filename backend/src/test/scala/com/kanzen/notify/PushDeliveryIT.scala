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
  * seam, marking each pushed (terminal/idempotent); a transport failure records the error for retry. Per-notification
  * assertions keep it parallelism-safe.
  */
object PushDeliveryIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val user = UUID.fromString("10000000-0000-0000-0000-000000000001")

  /** Insert a push-channel notification; returns its id. */
  private def insertPush(xa: Transactor[IO], title: String): IO[UUID] =
    sql"""insert into notifications (tenant_id, user_id, owner_id, type, title, channels_sent)
          values ('7e000000-0000-0000-0000-000000000001'::uuid, $user, $user, 'test', $title, '["push","in_app"]'::jsonb)
          returning id""".query[UUID].unique.transact(xa)

  private def pushedAt(xa: Transactor[IO], id: UUID): IO[Option[Instant]] =
    sql"select pushed_at from notifications where id = $id".query[Option[Instant]].unique.transact(xa)

  test("the worker pushes a 'push'-channel notification through the seam; a pushed row is terminal (idempotent)") { xa =>
    for {
      id <- insertPush(xa, s"push-${UUID.randomUUID()}")
      before <- pushedAt(xa, id)
      _ <- PushDeliveryWorker.drainOnce(xa, StubPushTransport)
      after <- pushedAt(xa, id)
      _ <- PushDeliveryWorker.drainOnce(xa, StubPushTransport) // a delivered row isn't re-pushed
      again <- pushedAt(xa, id)
    } yield expect(before.isEmpty) and expect(after.isDefined) and expect(after == again)
  }

  test("a transport failure records the push error and leaves the row un-pushed for retry") { xa =>
    val transport: PushTransport = (_: NotificationRepo.PushPending) => IO.raiseError(new RuntimeException("APNs down"))
    for {
      id <- insertPush(xa, s"pushfail-${UUID.randomUUID()}")
      n <- NotificationRepo.pendingPush(500).transact(xa).map(_.find(_.id == id).get)
      _ <- transport.push(n).attempt.flatMap {
        case Left(e) => NotificationRepo.markPushError(n.id, e.getMessage).transact(xa)
        case Right(_) => IO.pure(0)
      }
      row <- sql"select pushed_at, push_error from notifications where id = $id"
        .query[(Option[Instant], Option[String])].unique.transact(xa)
    } yield expect(row._1.isEmpty) and expect(row._2.exists(_.contains("APNs down")))
  }

  test("a notification WITHOUT a push channel is never picked up by the push worker") { xa =>
    for {
      id <- sql"""insert into notifications (tenant_id, user_id, owner_id, type, title, channels_sent)
                  values ('7e000000-0000-0000-0000-000000000001'::uuid, $user, $user, 'test', ${"inapp-" + UUID.randomUUID()}, '["in_app"]'::jsonb)
                  returning id""".query[UUID].unique.transact(xa)
      pending <- NotificationRepo.pendingPush(500).transact(xa)
    } yield expect(!pending.exists(_.id == id)) // in_app-only → not a push delivery
  }
}
