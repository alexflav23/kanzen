package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F14 — transfer detection + auto-suggest scoring (pure). A candidate receipt is scored against an unmatched
  * transaction by amount, merchant and currency; >= 50 is suggestable.
  */
object ReconciliationService {
  def isTransferPair(aMinor: Long, bMinor: Long): Boolean = aMinor != 0L && aMinor == -bMinor

  val suggestThreshold = 50

  private def merchantMatch(a: Option[String], b: Option[String]): Boolean =
    (a, b) match {
      case (Some(x), Some(y)) =>
        val (lx, ly) = (x.trim.toLowerCase, y.trim.toLowerCase)
        lx.nonEmpty && ly.nonEmpty && (lx == ly || lx.contains(ly) || ly.contains(lx))
      case _ => false
    }

  /** Score a receipt as a match for a transaction → (0–100, reasons). Amount is the strongest signal (exact = +60,
    * within 2% = +35), then merchant (+30), then currency (+10).
    */
  def scoreMatch(
      txAmountMinor: Long,
      txMerchant: Option[String],
      txCurrency: String,
      rTotalMinor: Long,
      rMerchant: Option[String],
      rCurrency: String
  ): (Int, List[String]) = {
    val tx = math.abs(txAmountMinor)
    val r = math.abs(rTotalMinor)
    var score = 0
    val reasons = scala.collection.mutable.ListBuffer.empty[String]
    if (tx == r && tx != 0) { score += 60; reasons += "amount matches exactly" }
    else if (r != 0 && math.abs(tx - r).toDouble / r <= 0.02) { score += 35; reasons += "amount within 2%" }
    if (merchantMatch(txMerchant, rMerchant)) { score += 30; reasons += "merchant matches" }
    if (txCurrency.equalsIgnoreCase(rCurrency)) { score += 10; reasons += "same currency" }
    (math.min(score, 100), reasons.toList)
  }
}

object ReconciliationRepo {

  /** Match a bank transaction to a receipt; marks the transaction reconciled. */
  def matchTxnToReceipt(txnId: UUID, receiptId: UUID, amountMinor: Long): ConnectionIO[UUID] =
    for {
      m <-
        sql"""insert into reconciliation_matches (tenant_id, state)
              values (coalesce((select tenant_id from bank_transactions where id = $txnId), '7e000000-0000-0000-0000-000000000001'::uuid), 'matched')
              returning id""".query[UUID].unique
      _ <-
        sql"insert into match_members (match_id, member_type, member_id, amount_minor) values ($m, 'transaction', $txnId, $amountMinor)".update.run
      _ <-
        sql"insert into match_members (match_id, member_type, member_id, amount_minor) values ($m, 'receipt', $receiptId, $amountMinor)".update.run
      _ <- sql"update bank_transactions set reconciliation_state = 'matched' where id = $txnId".update.run
    } yield m

  def members(matchId: UUID): ConnectionIO[List[(String, UUID)]] =
    sql"select member_type, member_id from match_members where match_id = $matchId".query[(String, UUID)].to[List]

  /** Receipts not yet a member of any match — the candidate pool for auto-suggestions. */
  def unmatchedReceipts: ConnectionIO[List[(UUID, Option[String], Option[Long], Option[String])]] =
    sql"""select r.id, r.merchant, r.total_minor, r.currency from receipts r
          where not exists (select 1 from match_members m where m.member_type = 'receipt' and m.member_id = r.id)
          order by r.created_at desc"""
      .query[(UUID, Option[String], Option[Long], Option[String])]
      .to[List]
}
