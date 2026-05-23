package com.kanzen.search

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F28 integration test: full-text search returns the right entity. */
object SearchIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("full-text search finds an asset by maker and title") { xa =>
    val prog = for {
      _ <- SearchRepo.index("asset", UUID.randomUUID(), "Les Paul Standard", Some("Gibson guitar"))
      _ <- SearchRepo.index("asset", UUID.randomUUID(), "Royal Oak", Some("Audemars Piguet watch"))
      guitars <- SearchRepo.search("guitar")
      watches <- SearchRepo.search("Audemars")
    } yield (guitars, watches)
    prog.transact(xa).map { case (guitars, watches) =>
      expect(guitars.exists(_._2 == "Les Paul Standard")) and
        expect(!guitars.exists(_._2 == "Royal Oak")) and
        expect(watches.exists(_._2 == "Royal Oak"))
    }
  }
}
