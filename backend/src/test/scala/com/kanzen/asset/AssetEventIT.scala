package com.kanzen.asset

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

/** F19 integration test: lifecycle timeline + lifetime-cost rollup. */
object AssetEventIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("acquisition + service events accumulate into lifetime cost") { xa =>
    val prog = for {
      cat <- AssetRepo.createCategory("Watches", None)
      a <- AssetRepo.create("Royal Oak", Some("Audemars Piguet"), cat, "unique", 1, Json.obj())
      _ <- AssetEventRepo.add(a.id, "acquired", Some(3500000L), Some("GBP"), Some("Dealer"))
      _ <- AssetEventRepo.add(a.id, "serviced", Some(45000L), Some("GBP"), Some("AP service"))
      _ <- AssetEventRepo.add(a.id, "cleaned", None, None, None)
      timeline <- AssetEventRepo.timeline(a.id)
      lifetime <- AssetEventRepo.lifetimeCostMinor(a.id)
    } yield (timeline, lifetime)
    prog.transact(xa).map { case (timeline, lifetime) =>
      expect(timeline.size == 3) and expect(lifetime == 3545000L)
    }
  }
}
