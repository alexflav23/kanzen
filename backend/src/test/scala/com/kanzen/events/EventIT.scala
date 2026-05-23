package com.kanzen.events

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F34 integration test: outbox emit -> unpublished -> markPublished. */
object EventIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("emitted events are unpublished until relayed") { xa =>
    val prog = for {
      e1 <- EventRepo.emit("task.completed", "task", UUID.randomUUID(), Json.obj())
      _ <- EventRepo.emit("task.comment.added", "task", UUID.randomUUID(), Json.obj())
      before <- EventRepo.unpublished
      _ <- EventRepo.markPublished(e1)
      after <- EventRepo.unpublished
    } yield (e1, before, after)
    prog.transact(xa).map { case (e1, before, after) =>
      expect(before.size == 2) and expect(after.size == 1) and expect(!after.exists(_._1 == e1))
    }
  }
}
