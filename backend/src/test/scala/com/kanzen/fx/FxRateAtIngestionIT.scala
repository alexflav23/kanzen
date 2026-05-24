package com.kanzen.fx

import cats.effect.IO
import com.kanzen.bank.{BankRepo, TxIn}
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F37 AC1 — the rate-to-base is captured at ingestion for the transaction's own date and never re-stated: a later sync
  * does not overwrite it with today's rate. Native stays truth.
  */
object FxRateAtIngestionIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val booked = LocalDate.of(2026, 3, 15) // nearest-prior USD→GBP snapshot is 2026-01-01 = 0.79

  test("USD purchase captures fx_rate_to_base at its booked date; re-sync preserves it") { xa =>
    val prog = for {
      acct <- BankRepo.createAccount("USD card", "USD", None)
      tx = TxIn("usd-guitar-1", booked, 230000L, "USD", "debit", "Vintage guitar")
      _ <- BankRepo.ingest(acct.id, List(tx))
      txId <- BankRepo.list(acct.id).map(_.find(_.providerTxId.contains("usd-guitar-1")).get.id)
      fx0 <- BankRepo.fxOf(txId)
      // a NEW snapshot now makes the nearest-prior for booked=2026-03-15 a different rate
      _ <- FxRepo.addRate("USD", "GBP", 0.99, LocalDate.of(2026, 2, 1))
      // re-sync the same provider tx (idempotent) — must NOT overwrite the captured rate
      _ <- BankRepo.ingest(acct.id, List(tx))
      fx1 <- BankRepo.fxOf(txId)
    } yield (fx0, fx1)
    prog.transact(xa).map { case (fx0, fx1) =>
      expect(fx0.flatMap(_._1).contains(0.79)) and
        expect(fx0.flatMap(_._2).contains(booked)) and
        expect(fx1.flatMap(_._1).contains(0.79)) // unchanged after re-sync, despite the newer 0.99 snapshot
    }
  }
}
