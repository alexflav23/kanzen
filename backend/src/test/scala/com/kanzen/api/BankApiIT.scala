package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F12 — bank transactions: finance read (Manager carve-out, Staff 403), idempotent CSV import, AIS read-only. Seeded
  * Coutts account (V2_32).
  */
object BankApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")
  private val coutts = UUID.fromString("80000000-0000-0000-0000-000000000001")

  test("pure CSV parser tolerates a header + parses rows") {
    val csv =
      "provider_tx_id,booked_on,amount_minor,currency,direction,description\nx-1,2026-01-02,1299,GBP,debit,Coffee"
    IO.pure(Bank.parseCsv(csv) match {
      case Right(txs) =>
        expect(txs.size == 1) and expect(txs.head.amountMinor == 1299L) and expect(txs.head.providerTxId == "x-1")
      case Left(e) => failure(e)
    })
  }

  test("Manager sees accounts + seeded transactions; Staff is denied (403)") { xa =>
    for {
      accts <- Bank.accounts(xa, lorna).map(_.toOption.get)
      txs <- Bank.transactions(xa, lorna, coutts).map(_.toOption.get)
      staff <- Bank.accounts(xa, marcia)
    } yield expect(accts.exists(_.name == "Coutts Current")) and
      expect(txs.exists(_.merchant.contains("Waitrose"))) and
      expect(staff.left.exists(_._1.code == 403))
  }

  test("CSV import is idempotent (re-import inserts nothing)") { xa =>
    val csv =
      "provider_tx_id,booked_on,amount_minor,currency,direction,description\nimp-1,2026-02-01,9900,GBP,debit,Vendor A\nimp-2,2026-02-02,12000,GBP,debit,Vendor B"
    for {
      first <- Bank.importCsv(xa, toby, coutts, csv).map(_.toOption.get)
      second <- Bank.importCsv(xa, toby, coutts, csv).map(_.toOption.get)
    } yield expect(first.parsed == 2 && first.inserted == 2) and expect(second.inserted == 0)
  }

  // F12 — the bank-feed sync (AIS read-only) pulls deterministic transactions through the seam, idempotently.
  test("bank-feed sync ingests the feed's transactions and is idempotent; Staff is denied (403)") { xa =>
    for {
      first <- Bank.sync(xa, toby, coutts, com.kanzen.bank.StubBankFeed).map(_.toOption.get)
      second <- Bank.sync(xa, toby, coutts, com.kanzen.bank.StubBankFeed).map(_.toOption.get)
      denied <- Bank.sync(xa, marcia, coutts, com.kanzen.bank.StubBankFeed)
      txs <- Bank.transactions(xa, toby, coutts).map(_.toOption.get)
    } yield expect(first.parsed == 5 && first.inserted == 5) and // the stub yields 5 transactions
      expect(second.inserted == 0) and // re-sync is a no-op (idempotent on providerTxId)
      expect(denied.left.exists(_._1.code == 403)) and // AIS sync is Manager+ (Staff denied)
      expect(txs.exists(_.providerTxId.exists(_.startsWith("stub:")))) // a synced transaction is now on the account
  }

  test("Staff cannot import (403); a malformed CSV is 400") { xa =>
    for {
      denied <- Bank.importCsv(
        xa,
        marcia,
        coutts,
        "provider_tx_id,booked_on,amount_minor,currency,direction,description\ny-1,2026-01-01,100,GBP,debit,x"
      )
      bad <- Bank.importCsv(
        xa,
        toby,
        coutts,
        "provider_tx_id,booked_on,amount_minor,currency,direction,description\nz-1,not-a-date,abc,GBP,debit,x"
      )
    } yield expect(denied.left.exists(_._1.code == 403)) and expect(bad.left.exists(_._1.code == 400))
  }
}
