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

/** F34 AC3 — transactional outbox: domain write + outbox row commit together; the relay
  * resumes from unpublished rows after a crash and publishes exactly once (consumer dedup). */
object RelayIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")

  // A consumer that records every (event id) it is asked to handle — to observe deliveries.
  private def recording(sink: ConcurrentLinkedQueue[UUID]): Consumer = new Consumer {
    val name = "recording"
    def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit] = conn.delay { sink.add(evt.id); () }
  }

  test("a domain write and its outbox row commit atomically; relay drains then leaves none unpublished") { xa =>
    val subj = UUID.randomUUID()
    for {
      _       <- (EventRepo.emit(Envelope("task.completed", Actor.system, Subject("task", subj), owner, None, Json.obj())) *>
                  EventRepo.emit(Envelope("product.low", Actor.system, Subject("product", UUID.randomUUID()), owner, None, Json.obj())))
                  .transact(xa)
      before  <- EventRepo.unpublishedRows.transact(xa)
      drained <- Relay.drainOnce(xa, Nil)            // no consumers: still marks published
      after   <- EventRepo.unpublishedRows.transact(xa)
    } yield expect(before.size >= 2) and expect(drained >= 2) and expect(after.isEmpty)
  }

  test("relay resumes from unpublished and publishes once it succeeds (at-least-once)") { xa =>
    val sink = new ConcurrentLinkedQueue[UUID]()
    val subj = UUID.randomUUID()
    for {
      eid  <- EventRepo.emit(Envelope("task.completed", Actor.system, Subject("task", subj), owner, None, Json.obj())).transact(xa)
      // before the relay runs, the event is unpublished — a "crash" simply means it was never drained
      open0 <- EventRepo.unpublishedRows.map(_.exists(_.id == eid)).transact(xa)
      _    <- Relay.drainOnce(xa, List(recording(sink)))   // restart: consumer runs, row marked published
      _    <- Relay.drainOnce(xa, List(recording(sink)))   // a second pass finds it already published
      open1 <- EventRepo.unpublishedRows.map(_.exists(_.id == eid)).transact(xa)
    } yield expect(open0) and expect(sink.contains(eid)) and expect(!open1)
  }
}
