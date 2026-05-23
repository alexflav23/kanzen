package com.kanzen.insights

import cats.effect.IO
import com.kanzen.asset.{AssetRepo, ValuationRepo}
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

/** F29 integration test: total inventory value = sum of latest market valuations. */
object InsightsIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("total market value sums each asset's latest 'market' snapshot") { xa =>
    val prog = for {
      cat <- AssetRepo.createCategory("Watches", None)
      a1 <- AssetRepo.create("Royal Oak", Some("AP"), cat, "unique", 1, Json.obj())
      a2 <- AssetRepo.create("Nautilus", Some("PP"), cat, "unique", 1, Json.obj())
      _ <- ValuationRepo.add(a1.id, "market", 4000000L, "GBP", None)
      _ <- ValuationRepo.add(a1.id, "market", 4200000L, "GBP", None) // latest for a1
      _ <- ValuationRepo.add(a2.id, "market", 9800000L, "GBP", None)
      total <- InsightsRepo.totalMarketValueMinor
    } yield total
    prog.transact(xa).map(total => expect(total == 4200000L + 9800000L))
  }
}
