package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Wealth._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** Wave G (F42/F39/F41/F43) — entity-scoped double-entry, balance sheet that balances, net worth = assets + investments
  * − liabilities, and the Principal-private invariant (403).
  */
object WealthApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")

  private def entity(xa: Transactor[IO], name: String): IO[UUID] =
    Wealth.createEntity(xa, toby, CreateEntityReq(name, "individual", None, None, None)).map(_.toOption.get.id)
  private def account(xa: Transactor[IO], e: UUID, code: String, name: String, typ: String): IO[UUID] =
    Wealth.createAccount(xa, toby, CreateAccountReq(e, code, name, typ, None, None)).map(_.toOption.get.id)

  test("F39 — a balanced double-entry posts; an unbalanced one is rejected (422)") { xa =>
    for {
      e <- entity(xa, "F39 book")
      cash <- account(xa, e, s"cash-$e", "Cash", "asset")
      eq <- account(xa, e, s"eq-$e", "Opening Equity", "equity")
      ok <- Wealth
        .post(
          xa,
          toby,
          PostReq(
            Some(e),
            "opening_balance",
            Some("seed"),
            Some(LocalDate.now()),
            List(SplitReq(cash, 100000L, None), SplitReq(eq, -100000L, None))
          )
        )
        .map(_.toOption.get)
      bad <- Wealth.post(xa, toby, PostReq(Some(e), "opening_balance", None, None, List(SplitReq(cash, 100L, None))))
    } yield expect(ok.balanced) and expect(bad.left.exists(_._1.code == 422))
  }

  test("F43 — the balance sheet balances: assets = liabilities + equity") { xa =>
    for {
      e <- entity(xa, "F43 book")
      cash <- account(xa, e, s"cash-$e", "Cash", "asset")
      eq <- account(xa, e, s"eq-$e", "Opening Equity", "equity")
      prop <- account(xa, e, s"prop-$e", "Property", "asset")
      mort <- account(xa, e, s"mort-$e", "Mortgage", "liability")
      _ <- Wealth
        .post(
          xa,
          toby,
          PostReq(
            Some(e),
            "opening_balance",
            None,
            None,
            List(SplitReq(cash, 100000L, None), SplitReq(eq, -100000L, None))
          )
        )
        .map(_.toOption.get)
      _ <- Wealth
        .post(
          xa,
          toby,
          PostReq(
            Some(e),
            "acquisition",
            None,
            None,
            List(SplitReq(prop, 500000L, None), SplitReq(mort, -500000L, None))
          )
        )
        .map(_.toOption.get)
      bs <- Wealth.balanceSheet(xa, toby, Some(e)).map(_.toOption.get)
    } yield expect(bs.assetsMinor == 600000L) and expect(bs.liabilitiesMinor == 500000L) and
      expect(bs.equityMinor == 100000L) and expect(bs.balances)
  }

  test("F41 — net worth = GL assets + investments at market − liabilities (consolidated per entity)") { xa =>
    for {
      e <- entity(xa, "F41 book")
      cash <- account(xa, e, s"cash-$e", "Cash", "asset")
      eq <- account(xa, e, s"eq-$e", "Equity", "equity")
      mort <- account(xa, e, s"mort-$e", "Loan", "liability")
      _ <- Wealth
        .post(
          xa,
          toby,
          PostReq(
            Some(e),
            "opening_balance",
            None,
            None,
            List(SplitReq(cash, 300000L, None), SplitReq(eq, -300000L, None))
          )
        )
        .map(_.toOption.get)
      // loan drawdown: debit cash (+), credit liability (−) — liabilities are credit-normal
      _ <- Wealth
        .post(
          xa,
          toby,
          PostReq(Some(e), "transfer", None, None, List(SplitReq(cash, 50000L, None), SplitReq(mort, -50000L, None)))
        )
        .map(_.toOption.get)
      // an investment lot for this entity, valued at market
      sec <- Investments
        .createSecurity(xa, toby, Investments.CreateSecurityReq(s"SYM$e".take(12), "Test fund", None, None))
        .map(_.toOption.get.id)
      _ <- Investments.setPrice(xa, toby, sec, Investments.PriceReq(10000L, None)).map(_.toOption.get)
      _ <- Investments.buy(xa, toby, Investments.BuyReq(e, sec, 5.0, 45000L, None)).map(_.toOption.get)
      nw <- Wealth.netWorth(xa, toby, Some(e)).map(_.toOption.get)
    } yield expect(nw.cashAndOtherMinor == 350000L) and // 300000 opening + 50000 loan drawdown
      expect(nw.investmentsMinor == 50000L) and // 5 × 10000
      expect(nw.liabilitiesMinor == 50000L) and
      expect(nw.assetsMinor == 400000L) and expect(nw.netMinor == 350000L) // (350000+50000) − 50000
  }

  test("F43 — income statement sums income/expense GL flow for the period (seeded Individual book)") { xa =>
    val individual = UUID.fromString("40000000-0000-0000-0000-000000000001")
    val from = LocalDate.now().withDayOfYear(1)
    val to = LocalDate.now()
    for {
      is <- Wealth.incomeStatement(xa, toby, Some(individual), from, to).map(_.toOption.get)
      mgr <- Wealth.incomeStatement(xa, lorna, Some(individual), from, to) // Principal-private
    } yield expect(is.incomeMinor == 1200000L) and expect(is.expenseMinor == 450000L) and
      expect(is.netMinor == 750000L) and expect(mgr.left.exists(_._1.code == 403))
  }

  test("Private Wealth is Principal-only — Manager gets 403 on entities / net worth / create") { xa =>
    for {
      list <- Wealth.entities(xa, lorna)
      nw <- Wealth.netWorth(xa, lorna, None)
      mk <- Wealth.createEntity(xa, lorna, CreateEntityReq("X", "trust", None, None, None))
    } yield expect(list.left.exists(_._1.code == 403)) and
      expect(nw.left.exists(_._1.code == 403)) and expect(mk.left.exists(_._1.code == 403))
  }
}
