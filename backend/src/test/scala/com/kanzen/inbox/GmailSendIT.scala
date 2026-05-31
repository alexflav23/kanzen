package com.kanzen.inbox

import cats.effect.IO
import com.kanzen.db.TestDb
import com.kanzen.workspace.{StubWorkspaceAuth, WorkspaceRepo}
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** W9.4 / F44 — the outbound-Gmail dispatch substrate: inbox send → durable queue → IO worker → the GmailSender seam
  * (which honours the F44 "Workspace connected" contract). Fresh tenants + per-message assertions = parallelism-safe.
  */
object GmailSendIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val admin = UUID.fromString("10000000-0000-0000-0000-000000000001")

  private def freshTenant(xa: Transactor[IO]): IO[UUID] =
    sql"insert into tenants (slug, name) values (${"gs-" + UUID.randomUUID()}, 'GmailSend') returning id"
      .query[UUID].unique.transact(xa)

  private def enqueueRaw(xa: Transactor[IO], t: UUID, msg: UUID): IO[Unit] =
    sql"insert into gmail_send_queue (tenant_id, thread_id, message_id) values ($t, ${UUID.randomUUID()}, $msg)"
      .update.run.transact(xa).void

  private def status(xa: Transactor[IO], msg: UUID): IO[Option[(String, Option[String])]] =
    sql"select status, provider_message_id from gmail_send_queue where message_id = $msg"
      .query[(String, Option[String])].option.transact(xa)

  private def connectWorkspace(xa: Transactor[IO], t: UUID): IO[Unit] =
    WorkspaceRepo.connect(t, "kanzen.local", "sa@x.iam.gserviceaccount.com", s"dev:$t", List("gmail.send"), admin)
      .transact(xa).void

  test("the worker dispatches a queued message through the seam + records the provider id (Workspace connected)") { xa =>
    val sender = new StubGmailSender(new StubWorkspaceAuth(xa))
    val msg = UUID.randomUUID()
    for {
      t <- freshTenant(xa)
      _ <- connectWorkspace(xa, t)
      _ <- enqueueRaw(xa, t, msg)
      _ <- GmailSendWorker.drainOnce(xa, sender)
      st <- status(xa, msg)
    } yield expect(st.exists(_._1 == "sent")) and expect(st.exists(_._2.contains(s"stub-gmail:$msg")))
  }

  test("the worker fails the dispatch when the tenant hasn't connected Workspace (the F44 contract holds)") { xa =>
    val sender = new StubGmailSender(new StubWorkspaceAuth(xa))
    val msg = UUID.randomUUID()
    for {
      t <- freshTenant(xa) // no Workspace connected
      _ <- enqueueRaw(xa, t, msg)
      _ <- GmailSendWorker.drainOnce(xa, sender)
      st <- status(xa, msg)
    } yield expect(st.exists(_._1 == "failed")) and expect(st.exists(_._2.isEmpty))
  }

  test("enqueue is idempotent on message_id (a re-enqueued send coalesces — never sent twice)") { xa =>
    val msg = UUID.randomUUID()
    val thread = UUID.randomUUID()
    for {
      _ <- GmailSendQueueRepo.enqueue(thread, msg).transact(xa)
      _ <- GmailSendQueueRepo.enqueue(thread, msg).transact(xa)
      n <- sql"select count(*) from gmail_send_queue where message_id = $msg".query[Int].unique.transact(xa)
    } yield expect(n == 1)
  }
}
