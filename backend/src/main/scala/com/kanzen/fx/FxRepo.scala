package com.kanzen.fx

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate

final case class Currency(code: String, symbol: Option[String], decimals: Int)

/** F37 — convert at the rate on the transaction's own date (rounded; native stays truth). */
object FxService {

  /** Our reporting/base currency (configurable; default GBP). */
  val Base = "GBP"

  def convertMinor(amountMinor: Long, rate: Double): Long = math.round(amountMinor * rate)

  /** Cross rate from→to via the base: 1 from = (fromToBase / toToBase) to. (`*ToBase` = 1 unit of that currency
    * expressed in base; base→base = 1.0.)
    */
  def cross(fromToBase: Double, toToBase: Double): Double = fromToBase / toToBase
}

object FxRepo {
  import FxService.Base

  def addRate(base: String, quote: String, rate: Double, asOf: LocalDate): ConnectionIO[Int] =
    sql"insert into fx_rates (base, quote, rate, as_of) values ($base, $quote, $rate, $asOf) on conflict (base, quote, as_of) do update set rate = excluded.rate".update.run

  /** The rate effective ON a given date = the latest snapshot on-or-before it (nearest prior). */
  def rateOn(base: String, quote: String, on: LocalDate): ConnectionIO[Option[Double]] =
    sql"select rate from fx_rates where base = $base and quote = $quote and as_of <= $on order by as_of desc limit 1"
      .query[Double]
      .option

  /** 1 unit of `currency` expressed in our base, on a date (base→base = 1.0). */
  def toBaseOn(currency: String, on: LocalDate): ConnectionIO[Option[Double]] =
    if (currency == Base) Option(1.0).pure[ConnectionIO] else rateOn(currency, Base, on)

  /** The rate to convert `amount in from` → `to` on a date (triangulated via base). */
  def crossRateOn(from: String, to: String, on: LocalDate): ConnectionIO[Option[Double]] =
    if (from == to) Option(1.0).pure[ConnectionIO]
    else (toBaseOn(from, on), toBaseOn(to, on)).mapN((f, t) => (f, t).mapN(FxService.cross))

  def currencies: ConnectionIO[List[Currency]] =
    sql"select code, symbol, decimals from currencies where active order by code".query[Currency].to[List]
}
