package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F14 — transfer detection: equal-and-opposite amounts between the household's own accounts. */
object ReconciliationService {
  def isTransferPair(aMinor: Long, bMinor: Long): Boolean = aMinor != 0L && aMinor == -bMinor
}

object ReconciliationRepo {
  /** Match a bank transaction to a receipt; marks the transaction reconciled. */
  def matchTxnToReceipt(txnId: UUID, receiptId: UUID, amountMinor: Long): ConnectionIO[UUID] =
    for {
      m <- sql"insert into reconciliation_matches (state) values ('matched') returning id".query[UUID].unique
      _ <- sql"insert into match_members (match_id, member_type, member_id, amount_minor) values ($m, 'transaction', $txnId, $amountMinor)".update.run
      _ <- sql"insert into match_members (match_id, member_type, member_id, amount_minor) values ($m, 'receipt', $receiptId, $amountMinor)".update.run
      _ <- sql"update bank_transactions set reconciliation_state = 'matched' where id = $txnId".update.run
    } yield m

  def members(matchId: UUID): ConnectionIO[List[(String, UUID)]] =
    sql"select member_type, member_id from match_members where match_id = $matchId".query[(String, UUID)].to[List]
}
