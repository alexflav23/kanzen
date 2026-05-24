package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Investments._
import com.kanzen.api.Wealth.{CreateEntityReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F40 — cost-basis lots, holdings valuation with unrealised gain, and FIFO sells producing
  * realised gains. Records investments, never trades. Principal-private. */
object InvestmentsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby  = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna = Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")

  private def entity(xa: Transactor[IO]): IO[UUID] =
    Wealth.createEntity(xa, toby, CreateEntityReq("inv book", "individual", None, None, None)).map(_.toOption.get.id)
  private def security(xa: Transactor[IO], sym: String): IO[UUID] =
    Investments.createSecurity(xa, toby, CreateSecurityReq(sym, "Sec", None, None)).map(_.toOption.get.id)

  test("buy opens a lot; holdings value at the latest price with an unrealised gain") { xa =>
    for {
      e   <- entity(xa)
      sec <- security(xa, s"H${UUID.randomUUID().toString.take(6)}")
      _   <- Investments.setPrice(xa, toby, sec, PriceReq(10000L, None)).map(_.toOption.get)
      _   <- Investments.buy(xa, toby, BuyReq(e, sec, 10.0, 90000L, None)).map(_.toOption.get)
      hs  <- Investments.holdings(xa, toby, Some(e)).map(_.toOption.get)
      h    = hs.find(_.securityId == sec).get
    } yield expect(h.quantity == 10.0) and expect(h.costBasisMinor == 90000L) and
      expect(h.marketValueMinor == 100000L) and expect(h.unrealizedGainMinor == 10000L) // 10×10000 − 90000
  }

  test("FIFO sell closes oldest lots first → realised gain = proceeds − closed cost basis") { xa =>
    for {
      e    <- entity(xa)
      sec  <- security(xa, s"S${UUID.randomUUID().toString.take(6)}")
      _    <- Investments.buy(xa, toby, BuyReq(e, sec, 10.0, 100000L, Some(LocalDate.of(2026, 1, 1)))).map(_.toOption.get) // lot1 (older)
      _    <- Investments.buy(xa, toby, BuyReq(e, sec, 10.0, 120000L, Some(LocalDate.of(2026, 3, 1)))).map(_.toOption.get) // lot2
      sell <- Investments.sell(xa, toby, SellReq(e, sec, 15.0, 180000L, None)).map(_.toOption.get)
    } yield // FIFO: all of lot1 (cost 100000) + 5/10 of lot2 (cost 60000) = 160000; gain = 180000 − 160000
      expect(sell.costBasisMinor == 160000L) and expect(sell.realizedGainMinor == 20000L)
  }

  test("selling more than held is rejected (409)") { xa =>
    for {
      e    <- entity(xa)
      sec  <- security(xa, s"X${UUID.randomUUID().toString.take(6)}")
      _    <- Investments.buy(xa, toby, BuyReq(e, sec, 3.0, 30000L, None)).map(_.toOption.get)
      over <- Investments.sell(xa, toby, SellReq(e, sec, 10.0, 99999L, None))
    } yield expect(over.left.exists(_._1.code == 409))
  }

  test("Investments are Principal-only — Manager gets 403") { xa =>
    for {
      secs <- Investments.securities(xa, lorna)
      buy  <- Investments.buy(xa, lorna, BuyReq(UUID.randomUUID(), UUID.randomUUID(), 1.0, 100L, None))
    } yield expect(secs.left.exists(_._1.code == 403)) and expect(buy.left.exists(_._1.code == 403))
  }
}
