package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.fx.{FxRefresher, FxRepo, FxService, StubFxRates}
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F37 — the FX-rate refresh: every active currency re-quoted against the base through the FxRateSource seam
  * (StubFxRates now), written as an `ecb` rate; Manager+ (mutates shared market data). The real ECB feed drops in.
  */
object FxRefreshIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  test("refreshAll writes each non-base currency's stub rate as today's `ecb` rate") { xa =>
    for {
      ccys <- FxRepo.currencies.transact(xa)
      n <- FxRefresher.refreshAll(xa, StubFxRates)
      // USD is a seeded currency; its refreshed rate must equal the stub's deterministic value for today, source 'ecb'
      usd <- FxRepo.rateOn(FxService.Base, "USD", LocalDate.now()).transact(xa)
      src <- sql"select source from fx_rates where base = ${FxService.Base} and quote = 'USD' and as_of = ${LocalDate.now()}"
        .query[String]
        .option
        .transact(xa)
      expected = StubFxRates.rateFor(FxService.Base, "USD", LocalDate.now())
    } yield expect(ccys.nonEmpty) and expect(n == ccys.count(_.code != FxService.Base)) and
      expect(usd.exists(r => math.abs(r - expected) < 1e-9)) and expect(src.contains("ecb"))
  }

  test("the endpoint is Manager+: Staff is forbidden; a Manager + the Principal get a count") { xa =>
    for {
      staff <- Fx.refreshRates(xa, marcia)
      mgr <- Fx.refreshRates(xa, lorna)
      principal <- Fx.refreshRates(xa, toby)
    } yield expect(staff.left.exists(_._1.code == 403)) and
      expect(mgr.exists(_.updated >= 0)) and expect(principal.exists(_.updated >= 0))
  }

  test("the stub rate is deterministic per (pair, day); base→base is 1.0") { _ =>
    val day = LocalDate.of(2026, 6, 1)
    IO.pure(
      expect(StubFxRates.rateFor("GBP", "USD", day) == StubFxRates.rateFor("GBP", "USD", day)) and
        expect(StubFxRates.rateFor("GBP", "GBP", day) == 1.0) and
        expect(StubFxRates.rateFor("GBP", "USD", day) != StubFxRates.rateFor("GBP", "EUR", day))
    )
  }
}
