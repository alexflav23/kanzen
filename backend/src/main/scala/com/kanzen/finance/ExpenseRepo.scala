package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Expense(
    id: UUID,
    payee: Option[String],
    amountMinor: Long,
    currency: String,
    status: String,
)

/** F17 — expense persistence with threshold-driven initial status. */
object ExpenseRepo {
  def create(payee: Option[String], amountMinor: Long, currency: String, requestedBy: Option[UUID]): ConnectionIO[Expense] = {
    val status = ExpenseService.initialStatus(amountMinor, currency)
    sql"""insert into expenses (payee, amount_minor, currency, status, requested_by)
          values ($payee, $amountMinor, $currency, $status, $requestedBy)
          returning id, payee, amount_minor, currency, status""".query[Expense].unique
  }

  def approve(id: UUID, @annotation.unused by: UUID): ConnectionIO[Int] =
    sql"update expenses set status = 'approved' where id = $id".update.run

  def get(id: UUID): ConnectionIO[Option[Expense]] =
    sql"select id, payee, amount_minor, currency, status from expenses where id = $id".query[Expense].option
}
