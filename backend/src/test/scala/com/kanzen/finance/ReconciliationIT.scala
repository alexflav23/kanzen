package com.kanzen.finance

import cats.effect.IO
import com.kanzen.bank.{BankRepo, TxIn}
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F14 integration test: match a bank transaction to a receipt; transaction becomes reconciled. */
object ReconciliationIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("matching a transaction to a receipt links both and marks the txn reconciled") { xa =>
    val prog = for {
      acct <- BankRepo.createAccount("Coutts", "GBP", Some("current"))
      _ <- BankRepo.ingest(acct.id, List(TxIn("gc-rec-1", LocalDate.now, 4200L, "GBP", "debit", "Waitrose")))
      txns <- BankRepo.list(acct.id)
      txn = txns.head
      receipt <- ReceiptRepo.create(Some("Waitrose"), Some(4200L), Some("GBP"))
      matchId <- ReconciliationRepo.matchTxnToReceipt(txn.id, receipt.id, 4200L)
      members <- ReconciliationRepo.members(matchId)
      after <- BankRepo.list(acct.id)
    } yield (members, after.head)

    prog.transact(xa).map { case (members, txn) =>
      expect(members.size == 2) and
        expect(members.exists(_._1 == "transaction")) and
        expect(members.exists(_._1 == "receipt")) and
        expect(txn.reconciliationState == "matched")
    }
  }
}
