package com.kanzen.fx

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F37 integration test: rate-on-date picks the nearest-prior snapshot (historical accuracy). */
object FxIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("rateOn returns the rate effective on the transaction date") { xa =>
    val prog = for {
      _ <- FxRepo.addRate("GBP", "USD", 1.25, LocalDate.of(2026, 1, 1))
      _ <- FxRepo.addRate("GBP", "USD", 1.30, LocalDate.of(2026, 5, 1))
      march <- FxRepo.rateOn("GBP", "USD", LocalDate.of(2026, 3, 15))
      june <- FxRepo.rateOn("GBP", "USD", LocalDate.of(2026, 6, 1))
    } yield (march, june)
    prog.transact(xa).map { case (march, june) =>
      expect(march.contains(1.25)) and expect(june.contains(1.30))
    }
  }
}
