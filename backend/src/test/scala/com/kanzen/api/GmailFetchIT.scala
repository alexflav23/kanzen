package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.inbox.StubEmailSource
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** W9.1/F25 — inbound Gmail fetch: "Sync inbox" pulls deterministic mail through the EmailSource seam into threads,
  * idempotently, and only for a mailbox the caller can see (no syncing a hidden mailbox).
  */
object GmailFetchIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("sync pulls mail into a mailbox as threads, idempotently (re-sync creates nothing)") { xa =>
    for {
      inboxes <- Inbox.inboxes(xa, toby).map(_.toOption.get)
      inbox = inboxes.head
      first <- Inbox.syncInbox(xa, toby, inbox.id, StubEmailSource).map(_.toOption.get)
      second <- Inbox.syncInbox(xa, toby, inbox.id, StubEmailSource).map(_.toOption.get)
      // the fetched threads are now in the mailbox
      threads <- Inbox.threads(xa, toby, Some(inbox.id), Some("inbox"), None).map(_.toOption.get)
    } yield expect(first.fetched == 3 && first.created == 3) and // 3 stub emails, all new
      expect(second.created == 0) and // idempotent on provider_thread_id
      expect(threads.exists(_.subject.exists(_.contains("delivery is on its way"))))
  }

  test("a caller can't sync a mailbox they can't see (no hidden-mailbox sync)") { xa =>
    for {
      tobyBoxes <- Inbox.inboxes(xa, toby).map(_.toOption.get)
      marciaBoxes <- Inbox.inboxes(xa, marcia).map(_.toOption.get.map(_.id).toSet)
      // a mailbox the Principal sees but Staff (marcia) doesn't — syncing it as marcia must be denied
      hidden = tobyBoxes.map(_.id).find(id => !marciaBoxes.contains(id))
      denied <- hidden.fold(IO.pure(Option.empty[(sttp.model.StatusCode, ApiError)]))(id =>
        Inbox.syncInbox(xa, marcia, id, StubEmailSource).map(_.left.toOption)
      )
    } yield expect(hidden.isDefined) and expect(denied.exists(_._1.code == 403))
  }
}
