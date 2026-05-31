package com.kanzen.fx

import cats.effect.IO
import cats.syntax.all._
import doobie.implicits._
import doobie.util.transactor.Transactor

import java.time.LocalDate

/** F37 — the FX-rate seam: 1 unit of `base` expressed in `quote` (e.g. base=GBP, quote=USD → ~1.27). [[StubFxRates]]
  * returns deterministic, gently day-varying rates so the sandbox shows live-looking FX without a feed; the real
  * `EcbFxRates` (the ECB daily reference rates, operator-gated per `SETUP.md`) drops in behind this trait. Rates are
  * global (shared market data), so a refresh writes `fx_rates` with `source = 'ecb'`.
  */
trait FxRateSource {
  def rate(base: String, quote: String): IO[Option[Double]]
}

/** Deterministic stand-in: a stable per-pair base rate nudged by the day-of-year. Reproducible (tests pin the formula),
  * never random. base==quote ⇒ 1.0.
  */
object StubFxRates extends FxRateSource {
  private val anchors: Map[String, Double] =
    Map("GBP" -> 1.0, "USD" -> 1.27, "EUR" -> 1.17, "SGD" -> 1.71, "CHF" -> 1.12, "JPY" -> 190.0, "AUD" -> 1.92)

  /** 1 GBP in `quote` on `day` (pure, exposed so tests assert exact values). */
  def rateFor(base: String, quote: String, day: LocalDate): Double =
    if (base == quote) 1.0
    else {
      val b = anchors.getOrElse(base, 1.0)
      val q = anchors.getOrElse(quote, 1.0)
      val wobble = 1.0 + ((day.getDayOfYear % 7) - 3) * 0.001 // ±0.3% deterministic daily drift
      (q / b) * wobble
    }

  def rate(base: String, quote: String): IO[Option[Double]] =
    IO.realTimeInstant.map(now => Some(rateFor(base, quote, now.atZone(java.time.ZoneOffset.UTC).toLocalDate)))
}

/** Refresh today's rate for every active currency against the base, through the [[FxRateSource]] seam. Returns the
  * number of pairs updated. Idempotent (upsert on (base, quote, as_of)).
  */
object FxRefresher {
  def refreshAll(xa: Transactor[IO], src: FxRateSource): IO[Int] = {
    val base = FxService.Base
    FxRepo.currencies.transact(xa).flatMap { ccys =>
      val today = LocalDate.now()
      ccys
        .filter(_.code != base)
        .traverse { c =>
          src.rate(base, c.code).flatMap {
            case Some(r) => FxRepo.addRate(base, c.code, r, today, "ecb").transact(xa).as(1)
            case None => IO.pure(0)
          }
        }
        .map(_.sum)
    }
  }
}
