package com.kanzen.ledger

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class GlAccount(id: UUID, code: String, name: String, accountType: String, currency: String)
final case class RegisterRow(transactionId: UUID, kind: String, description: Option[String], occurredOn: LocalDate, amountMinor: Long, memo: Option[String])

/** F18 / ADR-001 — the double-entry invariant: a transaction's signed splits must sum to
  * zero, with at least two splits and at least one non-zero amount. Balanced-or-rejected. */
object GeneralLedger {
  def balanced(amounts: List[Long]): Boolean =
    amounts.size >= 2 && amounts.sum == 0L && amounts.exists(_ != 0L)
}

object GlRepo {
  def createAccount(ownerId: UUID, code: String, name: String, accountType: String, currency: String): ConnectionIO[GlAccount] =
    sql"""insert into gl_accounts (owner_id, code, name, type, currency)
          values ($ownerId, $code, $name, $accountType, $currency)
          returning id, code, name, type, currency""".query[GlAccount].unique

  def accountExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from gl_accounts where id = $id)".query[Boolean].unique

  def insertTransaction(ownerId: UUID, kind: String, description: Option[String], occurredOn: LocalDate,
                        reverses: Option[UUID]): ConnectionIO[UUID] =
    sql"""insert into gl_transactions (owner_id, kind, description, occurred_on, reverses_transaction_id)
          values ($ownerId, $kind, $description, $occurredOn, $reverses) returning id""".query[UUID].unique

  def insertSplit(txnId: UUID, accountId: UUID, amountMinor: Long, memo: Option[String]): ConnectionIO[Int] =
    sql"insert into gl_splits (transaction_id, account_id, amount_minor, memo) values ($txnId, $accountId, $amountMinor, $memo)".update.run

  /** Derived balance = sum of the account's signed splits. */
  def balanceOf(accountId: UUID): ConnectionIO[Long] =
    sql"select coalesce(sum(amount_minor), 0) from gl_splits where account_id = $accountId".query[Long].unique

  def splitsOf(transactionId: UUID): ConnectionIO[List[(UUID, Long, Option[String])]] =
    sql"select account_id, amount_minor, memo from gl_splits where transaction_id = $transactionId".query[(UUID, Long, Option[String])].to[List]

  def transactionExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from gl_transactions where id = $id)".query[Boolean].unique

  /** The account register — every split touching the account, newest first. */
  def register(accountId: UUID): ConnectionIO[List[RegisterRow]] =
    sql"""select t.id, t.kind, t.description, t.occurred_on, s.amount_minor, s.memo
          from gl_splits s join gl_transactions t on t.id = s.transaction_id
          where s.account_id = $accountId
          order by t.occurred_on desc, t.created_at desc""".query[RegisterRow].to[List]
}
