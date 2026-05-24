package com.kanzen.bank

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F12 integration test: idempotent ingestion (re-ingesting the same batch adds nothing). */
object BankIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("ingestion dedups by provider transaction id") { xa =>
    val today = LocalDate.now
    val batch = List(
      TxIn("gc-1", today, 184000L, "GBP", "debit", "Hudson Sandler"),
      TxIn("gc-2", today, 4200L, "GBP", "debit", "Waitrose"),
      TxIn("gc-3", today, 5000L, "GBP", "credit", "Refund")
    )
    val prog = for {
      a <- BankRepo.createAccount("Coutts current", "GBP", Some("current"))
      first <- BankRepo.ingest(a.id, batch)
      again <- BankRepo.ingest(a.id, batch)
      all <- BankRepo.list(a.id)
    } yield (first, again, all)
    prog.transact(xa).map { case (first, again, all) =>
      expect(first == 3) and expect(again == 0) and expect(all.size == 3)
    }
  }
}
