package com.kanzen.fx

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate

/** F37 — convert at the rate on the transaction's own date (rounded; native stays truth). */
object FxService {
  def convertMinor(amountMinor: Long, rate: Double): Long = math.round(amountMinor * rate)
}

object FxRepo {
  def addRate(base: String, quote: String, rate: Double, asOf: LocalDate): ConnectionIO[Int] =
    sql"insert into fx_rates (base, quote, rate, as_of) values ($base, $quote, $rate, $asOf) on conflict (base, quote, as_of) do update set rate = excluded.rate".update.run

  /** The rate effective ON a given date = the latest snapshot on-or-before it (nearest prior). */
  def rateOn(base: String, quote: String, on: LocalDate): ConnectionIO[Option[Double]] =
    sql"select rate from fx_rates where base = $base and quote = $quote and as_of <= $on order by as_of desc limit 1"
      .query[Double].option
}
