package com.kanzen.events

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.db.TestDb
import doobie.ConnectionIO
import doobie.free.{connection => conn}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

/** F34 AC3 — transactional outbox: domain write + outbox row commit together; the relay resumes from unpublished rows
  * after a crash and publishes exactly once (consumer dedup).
  */
object RelayIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")

  // A consumer that records every (event id) it is asked to handle — to observe deliveries.
  private def recording(sink: ConcurrentLinkedQueue[UUID]): Consumer = new Consumer {
    val name = "recording"
    def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit] = conn.delay { sink.add(evt.id); () }
  }

  // ONE sequential test: `Relay.drainOnce` is GLOBAL (marks every unpublished row published), so two tests draining
  // concurrently within the suite would publish each other's events before the other asserts they're unpublished.
  test("transactional outbox: atomic commit + drain marks published; the relay resumes from unpublished, once") { xa =>
    val sink = new ConcurrentLinkedQueue[UUID]()
    for {
      // 1) a domain write + its two outbox rows commit together and are unpublished until drained
      ids <- (
        EventRepo.emit(
          Envelope("task.completed", Actor.system, Subject("task", UUID.randomUUID()), owner, None, Json.obj())
        ),
        EventRepo.emit(
          Envelope("product.low", Actor.system, Subject("product", UUID.randomUUID()), owner, None, Json.obj())
        )
      ).tupled.transact(xa)
      (id1, id2) = ids
      before <- EventRepo.unpublishedRows.map(_.map(_.id).toSet).transact(xa)
      drained <- Relay.drainOnce(xa, Nil) // no consumers: still marks published
      after <- EventRepo.unpublishedRows.map(_.map(_.id).toSet).transact(xa)
      // 2) resume: emit AFTER the first drain (so only our second drain touches it), the consumer runs once, at-least-once
      eid <- EventRepo
        .emit(Envelope("task.completed", Actor.system, Subject("task", UUID.randomUUID()), owner, None, Json.obj()))
        .transact(xa)
      open0 <- EventRepo.unpublishedRows.map(_.exists(_.id == eid)).transact(xa)
      _ <- Relay.drainOnce(xa, List(recording(sink))) // restart: consumer runs, row marked published
      _ <- Relay.drainOnce(xa, List(recording(sink))) // a second pass finds it already published
      open1 <- EventRepo.unpublishedRows.map(_.exists(_.id == eid)).transact(xa)
      // assert against OUR ids, never a global empty set — the test DB is shared across suites running in parallel.
    } yield expect(before(id1)) and expect(before(id2)) and expect(drained >= 2) and
      expect(!after(id1)) and expect(!after(id2)) and
      expect(open0) and expect(sink.contains(eid)) and expect(!open1)
  }
}
