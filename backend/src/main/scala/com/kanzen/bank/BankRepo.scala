package com.kanzen.bank

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class BankAccount(id: UUID, name: String, currency: String, kind: Option[String])
final case class BankTx(
    id: UUID,
    providerTxId: Option[String],
    bookedOn: Option[LocalDate],
    amountMinor: Long,
    currency: String,
    direction: String,
    description: Option[String],
    merchant: Option[String],
    reconciliationState: String,
)
final case class TxIn(providerTxId: String, bookedOn: LocalDate, amountMinor: Long, currency: String, direction: String, description: String)

/** F12 — bank accounts + idempotent transaction ingestion (dedup by provider tx id).
  * AIS read-only: Kanzen records reality, it never moves money. */
object BankRepo {
  private val txCols = fr"id, provider_tx_id, booked_on, amount_minor, currency, direction, description, merchant, reconciliation_state"

  def createAccount(name: String, currency: String, kind: Option[String]): ConnectionIO[BankAccount] =
    sql"insert into financial_accounts (name, currency, kind) values ($name, $currency, $kind) returning id, name, currency, kind"
      .query[BankAccount].unique

  def listAccounts: ConnectionIO[List[BankAccount]] =
    sql"select id, name, currency, kind from financial_accounts order by name".query[BankAccount].to[List]

  def accountExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from financial_accounts where id = $id)".query[Boolean].unique

  /** Ingest a batch; returns the number of NEW rows (re-ingesting the same batch inserts 0). */
  def ingest(accountId: UUID, txs: List[TxIn]): ConnectionIO[Int] =
    txs.traverse { t =>
      sql"""insert into bank_transactions (account_id, provider_tx_id, booked_on, amount_minor, currency, direction, description)
            values ($accountId, ${t.providerTxId}, ${t.bookedOn}, ${t.amountMinor}, ${t.currency}, ${t.direction}, ${t.description})
            on conflict (account_id, provider_tx_id) do nothing""".update.run
    }.map(_.sum)

  def list(accountId: UUID): ConnectionIO[List[BankTx]] =
    (fr"select" ++ txCols ++ fr"from bank_transactions where account_id = $accountId order by booked_on desc").query[BankTx].to[List]

  def findTx(id: UUID): ConnectionIO[Option[BankTx]] =
    (fr"select" ++ txCols ++ fr"from bank_transactions where id = $id").query[BankTx].option

  def unmatched(accountId: UUID): ConnectionIO[List[BankTx]] =
    (fr"select" ++ txCols ++ fr"from bank_transactions where account_id = $accountId and reconciliation_state = 'unmatched' order by booked_on desc").query[BankTx].to[List]
}
