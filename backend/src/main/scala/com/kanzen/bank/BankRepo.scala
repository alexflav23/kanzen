package com.kanzen.bank

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class BankAccount(id: UUID, name: String, currency: String)
final case class BankTx(id: UUID, providerTxId: Option[String], amountMinor: Long, reconciliationState: String)
final case class TxIn(providerTxId: String, bookedOn: LocalDate, amountMinor: Long, currency: String, direction: String, description: String)

/** F12 — bank accounts + idempotent transaction ingestion (dedup by provider tx id). */
object BankRepo {
  def createAccount(name: String, currency: String, kind: Option[String]): ConnectionIO[BankAccount] =
    sql"insert into financial_accounts (name, currency, kind) values ($name, $currency, $kind) returning id, name, currency"
      .query[BankAccount].unique

  /** Ingest a batch; returns the number of NEW rows (re-ingesting the same batch inserts 0). */
  def ingest(accountId: UUID, txs: List[TxIn]): ConnectionIO[Int] =
    txs.traverse { t =>
      sql"""insert into bank_transactions (account_id, provider_tx_id, booked_on, amount_minor, currency, direction, description)
            values ($accountId, ${t.providerTxId}, ${t.bookedOn}, ${t.amountMinor}, ${t.currency}, ${t.direction}, ${t.description})
            on conflict (account_id, provider_tx_id) do nothing""".update.run
    }.map(_.sum)

  def list(accountId: UUID): ConnectionIO[List[BankTx]] =
    sql"select id, provider_tx_id, amount_minor, reconciliation_state from bank_transactions where account_id = $accountId"
      .query[BankTx].to[List]
}
