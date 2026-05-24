package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.events.{Actor, Envelope, EventRepo, NotificationFanout, Subject}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F34 — the notification-centre API: self-scoped inbox/read, subscriptions and device registry. One user can never
  * read or mark-read another's notifications.
  */
object NotificationsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  private def fanout(xa: Transactor[IO], env: Envelope): IO[UUID] =
    for {
      eid <- EventRepo.emit(env).transact(xa)
      rows <- EventRepo.unpublishedRows.transact(xa)
      _ <- NotificationFanout.handle(rows.find(_.id == eid).get).transact(xa)
    } yield eid

  test("device registration validates platform (400) and is idempotent on the token") { xa =>
    for {
      ok <- Notifications.registerDevice(xa, marcia, Notifications.DeviceReq("fcm", "tok-123"))
      dup <- Notifications.registerDevice(
        xa,
        marcia,
        Notifications.DeviceReq("fcm", "tok-123")
      ) // re-register refreshes
      bad <- Notifications.registerDevice(xa, marcia, Notifications.DeviceReq("pigeon", "x"))
    } yield expect(ok.isRight) and expect(dup.isRight) and expect(bad.left.exists(_._1.code == 400))
  }

  test("a user can create and list their own subscriptions") { xa =>
    for {
      created <- Notifications.createSub(xa, marcia, Notifications.CreateSubReq("task.comment.*", List("in_app")))
      subs <- Notifications.subscriptions(xa, marcia).map(_.toOption.get)
    } yield expect(created.isRight) and expect(subs.exists(_.eventTypePattern == "task.comment.*"))
  }

  test("inbox shows fanned-out notifications; mark-read is self-scoped") { xa =>
    val env =
      Envelope("task.completed", Actor.system, Subject("task", UUID.randomUUID()), toby.userId, None, Json.obj())
    for {
      _ <- fanout(xa, env)
      inbox <- Notifications.inbox(xa, toby).map(_.toOption.get)
      item = inbox.items.find(_.`type` == "task.completed").get
      // Marcia cannot mark Toby's notification read (not hers) → Ok(false), no rows touched
      byOther <- Notifications.markRead(xa, marcia, item.id).map(_.toOption.get)
      // Toby can
      byOwner <- Notifications.markRead(xa, toby, item.id).map(_.toOption.get)
      // Marcia's inbox never contained Toby's task.completed
      mInbox <- Notifications.inbox(xa, marcia).map(_.toOption.get)
    } yield expect(inbox.unread >= 1L) and
      expect(!byOther.ok) and expect(byOwner.ok) and
      expect(!mInbox.items.exists(_.id == item.id))
  }
}
