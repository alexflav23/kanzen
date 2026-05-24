package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Reconciliation.MatchReq
import com.kanzen.auth.Principal
import com.kanzen.bank.{BankRepo, TxIn}
import com.kanzen.db.TestDb
import com.kanzen.receipt.ReceiptRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F14 — reconciliation + the single-spend guarantee: a transaction matched to a receipt is reconciled once and cannot
  * be matched again (409).
  */
object ReconciliationApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  final case class Fixture(accountId: UUID, txnId: UUID, receiptId: UUID)

  /** Fresh account + one unmatched txn + a matching receipt. */
  private def setup(xa: Transactor[IO]): IO[Fixture] =
    (for {
      acct <- BankRepo.createAccount(s"acct-${UUID.randomUUID()}", "GBP", Some("current"))
      _ <- BankRepo.ingest(
        acct.id,
        List(TxIn(s"tx-${UUID.randomUUID()}", LocalDate.now, 4200L, "GBP", "debit", "Waitrose"))
      )
      txns <- BankRepo.list(acct.id)
      r <- ReceiptRepo.create(owner, "receipt", Some("Waitrose"), Some(4200L), Some("GBP"))
    } yield Fixture(acct.id, txns.head.id, r.id)).transact(xa)

  test("single-spend: a transaction matches once; a second match is rejected (409)") { xa =>
    for {
      f <- setup(xa)
      first <- Reconciliation.matchTxn(xa, lorna, MatchReq(f.txnId, f.receiptId))
      second <- Reconciliation.matchTxn(xa, lorna, MatchReq(f.txnId, f.receiptId))
    } yield expect(first.toOption.exists(_.state == "matched")) and
      expect(second.left.exists(_._1.code == 409)) // already reconciled
  }

  test("matching removes the transaction from the unmatched list") { xa =>
    for {
      f <- setup(xa)
      before <- Reconciliation.unmatched(xa, lorna, f.accountId).map(_.toOption.get)
      _ <- Reconciliation.matchTxn(xa, lorna, MatchReq(f.txnId, f.receiptId))
      after <- Reconciliation.unmatched(xa, lorna, f.accountId).map(_.toOption.get)
    } yield expect(before.exists(_.id == f.txnId)) and expect(!after.exists(_.id == f.txnId))
  }

  test("Staff cannot match (403)") { xa =>
    for {
      f <- setup(xa)
      res <- Reconciliation.matchTxn(xa, marcia, MatchReq(f.txnId, f.receiptId))
    } yield expect(res.left.exists(_._1.code == 403))
  }

  test("auto-suggest: an unmatched txn gets its matching receipt as a top candidate (score 100)") { xa =>
    // a unique merchant + amount so the candidate is unambiguous despite the shared receipt pool
    val merchant = s"Vendor-${UUID.randomUUID().toString.take(8)}"
    val amount = 100000L + scala.util.Random.nextInt(900000)
    val prog = for {
      acct <- BankRepo.createAccount(s"acct-${UUID.randomUUID()}", "GBP", Some("current"))
      _ <- BankRepo.ingest(
        acct.id,
        List(TxIn(s"tx-${UUID.randomUUID()}", LocalDate.now, amount, "GBP", "debit", merchant))
      )
      txns <- BankRepo.list(acct.id)
      r <- ReceiptRepo.create(owner, "invoice", Some(merchant), Some(amount), Some("GBP"))
    } yield (acct.id, txns.head.id, r.id)
    for {
      ids <- prog.transact(xa)
      (accountId, txnId, receiptId) = ids
      sug <- Reconciliation.suggestions(xa, lorna, accountId).map(_.toOption.get)
      mine = sug.find(_.txn.id == txnId).get
      top = mine.candidates.head
    } yield expect(mine.candidates.forall(_.score >= 50)) and
      expect(top.receiptId == receiptId) and expect(top.score == 100) and
      expect(top.reasons.contains("amount matches exactly")) and expect(top.reasons.contains("merchant matches"))
  }

  test("Staff cannot see suggestions (403)") { xa =>
    for {
      f <- setup(xa)
      res <- Reconciliation.suggestions(xa, marcia, f.accountId)
    } yield expect(res.left.exists(_._1.code == 403))
  }

  test("matching an unknown transaction or receipt is 404") { xa =>
    for {
      f <- setup(xa)
      noTxn <- Reconciliation.matchTxn(xa, lorna, MatchReq(UUID.randomUUID(), UUID.randomUUID()))
      noRcpt <- Reconciliation.matchTxn(xa, lorna, MatchReq(f.txnId, UUID.randomUUID()))
    } yield expect(noTxn.left.exists(_._1.code == 404)) and expect(noRcpt.left.exists(_._1.code == 404))
  }
}
