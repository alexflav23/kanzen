package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Fx._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F37 — currencies & FX overlay: convert at rate-on-date (AC2/AC3 rollup with per-currency breakdown + dated-estimate
  * label), nearest-prior selection, missing-rate handling.
  */
object FxApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val on = LocalDate.of(2026, 3, 15) // nearest-prior snapshot is 2026-01-01

  test("currencies lists the active registry") { xa =>
    Fx.currencies(xa, toby)
      .map(_.toOption.get)
      .map(cs =>
        expect(cs.map(_.code).toSet.subsetOf(Set("GBP", "SGD", "USD", "EUR", "CHF")) && cs.exists(_.code == "GBP"))
      )
  }

  test("convert uses the rate effective on the date (USD→GBP at 0.79); identity rate is 1.0") { xa =>
    for {
      usd <- Fx.convert(xa, toby, ConvertReq(100000L, "USD", "GBP", Some(on))).map(_.toOption.get)
      gbp <- Fx.convert(xa, toby, ConvertReq(50000L, "GBP", "GBP", Some(on))).map(_.toOption.get)
    } yield expect(usd.rate == 0.79) and expect(usd.convertedMinor == 79000L) and
      expect(usd.label.contains("rate")) and
      expect(gbp.rate == 1.0) and expect(gbp.convertedMinor == 50000L)
  }

  test("AC2 — rollup to GBP totals across currencies with a per-currency breakdown") { xa =>
    val lines = List(Line("USD", 100000L), Line("SGD", 100000L), Line("CHF", 100000L))
    Fx.rollup(xa, toby, RollupReq("GBP", Some(on), lines)).map(_.toOption.get).map { r =>
      // 0.79 + 0.58 + 0.88 → 79000 + 58000 + 88000
      expect(r.totalMinor == 225000L) and
        expect(r.breakdown.size == 3) and
        expect(r.breakdown.map(_.currency) == List("CHF", "SGD", "USD")) and
        expect(r.breakdown.forall(b => b.nativeMinor == 100000L)) and // native is the primary truth
        expect(r.label.contains("dated estimate")) and
        expect(r.unconvertible.isEmpty)
    }
  }

  test("missing rate → 422 on convert; listed under unconvertible in a rollup (no silent blending)") { xa =>
    for {
      conv <- Fx.convert(xa, toby, ConvertReq(1000L, "JPY", "GBP", Some(on)))
      roll <- Fx
        .rollup(xa, toby, RollupReq("GBP", Some(on), List(Line("USD", 100000L), Line("JPY", 5000L))))
        .map(_.toOption.get)
    } yield expect(conv.left.exists(_._1.code == 422)) and
      expect(roll.unconvertible == List("JPY")) and expect(roll.totalMinor == 79000L) // JPY excluded, not fudged
  }
}
