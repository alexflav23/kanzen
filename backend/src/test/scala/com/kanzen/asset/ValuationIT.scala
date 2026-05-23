package com.kanzen.asset

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

/** F20 integration test: latest-by-kind valuation. */
object ValuationIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("current market value is the latest snapshot; history is retained") { xa =>
    val prog = for {
      cat <- AssetRepo.createCategory("Watches", None)
      a <- AssetRepo.create("Nautilus", Some("Patek Philippe"), cat, "unique", 1, Json.obj())
      _ <- ValuationRepo.add(a.id, "market", 9000000L, "GBP", Some("estimate"))
      _ <- ValuationRepo.add(a.id, "insured", 9500000L, "GBP", Some("Hiscox"))
      _ <- ValuationRepo.add(a.id, "market", 9800000L, "GBP", Some("auction comp"))
      market <- ValuationRepo.latest(a.id, "market")
      insured <- ValuationRepo.latest(a.id, "insured")
      history <- ValuationRepo.history(a.id)
    } yield (market, insured, history)
    prog.transact(xa).map { case (market, insured, history) =>
      expect(market.exists(_.amountMinor == 9800000L)) and
        expect(insured.exists(_.amountMinor == 9500000L)) and
        expect(history.size == 3)
    }
  }
}
