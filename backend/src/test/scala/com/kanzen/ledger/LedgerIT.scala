package com.kanzen.ledger

import cats.effect.IO
import com.kanzen.db.TestDb
import com.kanzen.ledger.LedgerService.Entry
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F18 integration test: a balanced acquisition posting drives derived balances. */
object LedgerIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("acquisition posting: asset account +amount, cash account -amount") { xa =>
    val prog = for {
      asset <- LedgerRepo.createAccount("asset:watches", "Watches", "asset", "GBP")
      cash <- LedgerRepo.createAccount("asset:cash", "Cash", "asset", "GBP")
      entries = List(Entry(asset, cash, 3500000L))
      _ <- LedgerRepo.postGroup("acquisition", entries, "GBP")
      assetBal <- LedgerRepo.balanceOf(asset)
      cashBal <- LedgerRepo.balanceOf(cash)
    } yield (LedgerService.balances(entries), assetBal, cashBal)
    prog.transact(xa).map { case (balanced, assetBal, cashBal) =>
      expect(balanced) and expect(assetBal == 3500000L) and expect(cashBal == -3500000L)
    }
  }
}
