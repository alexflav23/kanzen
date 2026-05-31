package com.kanzen.wealth

import cats.effect.IO
import cats.syntax.all._
import doobie.implicits._
import doobie.util.transactor.Transactor

import java.time.LocalDate

/** F40 — the market-data seam: a security `symbol` → its latest quote (price in minor units of the security's
  * currency). [[StubQuoteSource]] returns a deterministic, gently day-varying price so the sandbox shows live-looking
  * movement on a "refresh quotes" without a market-data subscription; the real `MarketDataQuoteSource` (an HTTP quotes
  * API, operator- gated per `SETUP.md`) drops in behind this trait. Quotes are global (market data is shared across
  * tenants, like the brand catalogue), so a refresh writes `security_prices` with `source = 'market'`.
  */
trait QuoteSource {
  def quote(symbol: String): IO[Option[Long]]
}

/** Deterministic stand-in: a stable base per symbol nudged by the day-of-year, so prices look like they move day to day
  * but every run is reproducible (the tests pin the formula). Never random — reproducibility over realism in sandbox.
  */
object StubQuoteSource extends QuoteSource {

  /** The price a given symbol resolves to on a given day (pure, exposed so tests assert exact values). */
  def priceFor(symbol: String, day: LocalDate): Long = {
    val base = 10_000L + (math.abs(symbol.hashCode.toLong) % 90_000L) // £100.00 … £999.99 (pence)
    val jitter = (day.getDayOfYear % 11) * 17L // a small, deterministic daily wobble
    base + jitter
  }
  def quote(symbol: String): IO[Option[Long]] =
    IO.realTimeInstant.map(now => Some(priceFor(symbol, now.atZone(java.time.ZoneOffset.UTC).toLocalDate)))
}

/** Refresh every security's price through the [[QuoteSource]] seam, recording it as a `market` quote for today. Returns
  * the number of securities updated. Idempotent (upsert on (security_id, as_of)).
  */
object QuoteRefresher {
  def refreshAll(xa: Transactor[IO], src: QuoteSource): IO[Int] =
    InvestmentRepo.securities.transact(xa).flatMap { secs =>
      val today = LocalDate.now()
      secs
        .traverse { s =>
          src.quote(s.symbol).flatMap {
            case Some(price) => InvestmentRepo.setPrice(s.id, price, today, "market").transact(xa).as(1)
            case None => IO.pure(0)
          }
        }
        .map(_.sum)
    }
}
