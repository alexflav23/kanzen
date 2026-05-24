package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Ledger.{AccountReq, PostReq, SplitIn}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.ledger.GeneralLedger
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F18 / ADR-001 — double-entry GL: balanced-or-rejected, derived balances, reversing corrections, Principal-private.
  */
object LedgerApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")

  private def accounts(xa: Transactor[IO]): IO[(UUID, UUID)] =
    for {
      a <- Ledger
        .createAccount(xa, toby, AccountReq(s"expense:groceries:${UUID.randomUUID()}", "Groceries", "expense", "GBP"))
        .map(_.toOption.get)
      b <- Ledger
        .createAccount(xa, toby, AccountReq(s"asset:cash:${UUID.randomUUID()}", "Cash", "asset", "GBP"))
        .map(_.toOption.get)
    } yield (a.id, b.id)

  test("the balanced invariant is a pure check") {
    IO.pure(
      expect(GeneralLedger.balanced(List(4200L, -4200L))) and
        expect(!GeneralLedger.balanced(List(4200L, -4000L))) and // unbalanced
        expect(!GeneralLedger.balanced(List(4200L))) and // single split
        expect(!GeneralLedger.balanced(List(0L, 0L))) // all zero
    )
  }

  test("a balanced expense posts; derived balances reflect the splits") { xa =>
    for {
      ab <- accounts(xa)
      (expenseAcc, cashAcc) = ab
      posted <- Ledger.post(
        xa,
        toby,
        PostReq(
          "expense",
          Some("Waitrose"),
          None,
          List(SplitIn(expenseAcc, 4200L, None), SplitIn(cashAcc, -4200L, None))
        )
      )
      expBal <- Ledger.balance(xa, toby, expenseAcc).map(_.toOption.get)
      cashBal <- Ledger.balance(xa, toby, cashAcc).map(_.toOption.get)
    } yield expect(posted.isRight) and expect(expBal.balanceMinor == 4200L) and expect(cashBal.balanceMinor == -4200L)
  }

  test("an unbalanced transaction is rejected (400)") { xa =>
    for {
      ab <- accounts(xa)
      (a, b) = ab
      bad <- Ledger.post(
        xa,
        toby,
        PostReq("expense", None, None, List(SplitIn(a, 4200L, None), SplitIn(b, -4000L, None)))
      )
    } yield expect(bad.left.exists(_._1.code == 400))
  }

  test("reversing a transaction nets the affected balances back to zero (immutable correction)") { xa =>
    for {
      ab <- accounts(xa)
      (a, b) = ab
      posted <- Ledger
        .post(xa, toby, PostReq("expense", None, None, List(SplitIn(a, 1000L, None), SplitIn(b, -1000L, None))))
        .map(_.toOption.get)
      _ <- Ledger.reverse(xa, toby, posted.transactionId)
      aBal <- Ledger.balance(xa, toby, a).map(_.toOption.get)
      reg <- Ledger.register(xa, toby, a).map(_.toOption.get)
    } yield expect(aBal.balanceMinor == 0L) and expect(reg.exists(_.kind == "reversal")) and expect(reg.size == 2)
  }

  test("the ledger is Principal-only: Manager is denied (403) on post + balance") { xa =>
    for {
      ab <- accounts(xa)
      (a, b) = ab
      post <- Ledger.post(
        xa,
        lorna,
        PostReq("expense", None, None, List(SplitIn(a, 100L, None), SplitIn(b, -100L, None)))
      )
      bal <- Ledger.balance(xa, lorna, a)
    } yield expect(post.left.exists(_._1.code == 403)) and expect(bal.left.exists(_._1.code == 403))
  }

  test("reversing an unknown transaction is 404") { xa =>
    Ledger.reverse(xa, toby, UUID.randomUUID()).map(r => expect(r.left.exists(_._1.code == 404)))
  }
}
