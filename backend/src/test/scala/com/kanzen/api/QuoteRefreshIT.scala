package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.wealth.{InvestmentRepo, QuoteRefresher, StubQuoteSource}
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F40 — the market-data refresh: every security re-quoted through the QuoteSource seam (StubQuoteSource now), written
  * as a `market` price; Principal-only (Private Wealth). The real quotes API drops in behind the seam.
  */
object QuoteRefreshIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("refreshAll writes each security's stub quote as today's market price") { xa =>
    for {
      secs <- InvestmentRepo.securities.transact(xa)
      n <- QuoteRefresher.refreshAll(xa, StubQuoteSource)
      // pick the first seeded security and check its latest price is exactly the stub's deterministic value for today
      head = secs.head
      latest <- InvestmentRepo.latestPrice(head.id).transact(xa)
      src <- sql"select source from security_prices where security_id = ${head.id} order by as_of desc limit 1"
        .query[String]
        .unique
        .transact(xa)
      expected = StubQuoteSource.priceFor(head.symbol, LocalDate.now())
    } yield expect(secs.nonEmpty) and expect(n == secs.size) and
      expect(latest.contains(expected)) and expect(src == "market")
  }

  test("the endpoint is Principal-only: a Staff caller is forbidden, the Principal gets a count") { xa =>
    for {
      staff <- Investments.refreshQuotes(xa, marcia)
      principal <- Investments.refreshQuotes(xa, toby)
    } yield expect(staff.left.exists(_._1.code == 403)) and expect(principal.exists(_.updated >= 0))
  }

  test("the stub quote is deterministic for a (symbol, day) — reproducible, never random") { _ =>
    val day = LocalDate.of(2026, 6, 1)
    IO.pure(
      expect(StubQuoteSource.priceFor("AAPL", day) == StubQuoteSource.priceFor("AAPL", day)) and
        expect(StubQuoteSource.priceFor("AAPL", day) != StubQuoteSource.priceFor("VWRL", day))
    )
  }
}
