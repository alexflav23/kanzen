package com.kanzen.events

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F34 AC1/AC5 — NotificationFanout matches subscriptions, **honours F02 at delivery** (Staff never told about finance
  * events), and is idempotent (no double-notify on redelivery).
  */
object NotificationFanoutIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby = UUID.fromString("10000000-0000-0000-0000-000000000001") // principal
  private val lorna = UUID.fromString("10000000-0000-0000-0000-000000000002") // manager
  private val marcia = UUID.fromString("10000000-0000-0000-0000-000000000003") // staff

  private def notifCount(eid: UUID, userId: UUID): ConnectionIO[Long] =
    sql"select count(*) from notifications where event_id = $eid and user_id = $userId".query[Long].unique

  private def emitAndFanout(xa: Transactor[IO], env: Envelope): IO[UUID] =
    for {
      eid <- EventRepo.emit(env).transact(xa)
      rows <- EventRepo.unpublishedRows.transact(xa)
      row = rows.find(_.id == eid).get
      _ <- NotificationFanout.handle(row).transact(xa)
    } yield eid

  test("AC1 — task.completed notifies the subscribed Principal in-app") { xa =>
    val env = Envelope("task.completed", Actor.system, Subject("task", UUID.randomUUID()), toby, None, Json.obj())
    for {
      eid <- emitAndFanout(xa, env)
      n <- notifCount(eid, toby).transact(xa)
    } yield expect(n == 1L)
  }

  test("AC5 — bill.variance_flagged reaches Principal + Manager but is F02-stripped from Staff") { xa =>
    val env =
      Envelope("bill.variance_flagged", Actor.system, Subject("bill", UUID.randomUUID()), toby, None, Json.obj())
    for {
      eid <- emitAndFanout(xa, env)
      t <- notifCount(eid, toby).transact(xa)
      l <- notifCount(eid, lorna).transact(xa)
      m <- notifCount(eid, marcia).transact(xa)
    } yield expect(t == 1L) and expect(l == 1L) and expect(m == 0L) // Staff have no finance visibility
  }

  test("redelivery is idempotent — a second fan-out of the same event adds no duplicate") { xa =>
    val env = Envelope("task.completed", Actor.system, Subject("task", UUID.randomUUID()), toby, None, Json.obj())
    for {
      eid <- EventRepo.emit(env).transact(xa)
      rows <- EventRepo.unpublishedRows.transact(xa)
      row = rows.find(_.id == eid).get
      _ <- NotificationFanout.handle(row).transact(xa)
      _ <- NotificationFanout.handle(row).transact(xa) // redelivery
      n <- notifCount(eid, toby).transact(xa)
    } yield expect(n == 1L)
  }
}
