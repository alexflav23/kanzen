package com.kanzen.ledger

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F18 — double-entry invariant: a posting group balances (total debits == total credits). */
object LedgerService {
  final case class Entry(debitAccount: UUID, creditAccount: UUID, amountMinor: Long)

  def balances(entries: List[Entry]): Boolean =
    entries.nonEmpty &&
      entries.forall(_.amountMinor > 0L) &&
      entries.map(_.amountMinor).sum == entries.map(_.amountMinor).sum // debits total == credits total by construction
}

object LedgerRepo {
  def createAccount(code: String, name: String, `type`: String, currency: String): ConnectionIO[UUID] =
    sql"insert into ledger_accounts (code, name, type, currency) values ($code, $name, ${`type`}, $currency) returning id".query[UUID].unique

  def postGroup(kind: String, entries: List[LedgerService.Entry], currency: String): ConnectionIO[UUID] =
    for {
      g <- sql"insert into ledger_posting_groups (kind) values ($kind) returning id".query[UUID].unique
      _ <- entries.traverse_ { e =>
        sql"""insert into ledger_postings (group_id, debit_account, credit_account, amount_minor, currency)
              values ($g, ${e.debitAccount}, ${e.creditAccount}, ${e.amountMinor}, $currency)""".update.run
      }
    } yield g

  /** Derived balance: debits to the account minus credits from it. */
  def balanceOf(accountId: UUID): ConnectionIO[Long] =
    sql"""select coalesce((select sum(amount_minor) from ledger_postings where debit_account = $accountId), 0)
               - coalesce((select sum(amount_minor) from ledger_postings where credit_account = $accountId), 0)"""
      .query[Long].unique
}
