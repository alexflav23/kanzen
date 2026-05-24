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
    deductible: Boolean,
    vatReclaimable: Boolean
)

/** F17 — expense persistence with threshold-driven initial status + deductibility flags. */
object ExpenseRepo {
  private val cols = fr"id, payee, amount_minor, currency, status, deductible, vat_reclaimable"

  def create(
      payee: Option[String],
      amountMinor: Long,
      currency: String,
      requestedBy: Option[UUID]
  ): ConnectionIO[Expense] = {
    val status = ExpenseService.initialStatus(amountMinor, currency)
    (fr"""insert into expenses (payee, amount_minor, currency, status, requested_by)
          values ($payee, $amountMinor, $currency, $status, $requestedBy) returning""" ++ cols).query[Expense].unique
  }

  /** API path: full submit with property/category/deductibility. */
  def submit(
      ownerId: UUID,
      payee: Option[String],
      description: Option[String],
      amountMinor: Long,
      currency: String,
      propertyId: Option[UUID],
      categoryId: Option[UUID],
      deductible: Boolean,
      vatReclaimable: Boolean,
      taxCategory: Option[String],
      requestedBy: UUID
  ): ConnectionIO[Expense] = {
    val status = ExpenseService.initialStatus(amountMinor, currency)
    (fr"""insert into expenses (owner_id, payee, description, amount_minor, currency, status, property_id, category_id, deductible, vat_reclaimable, tax_category, requested_by)
          values ($ownerId, $payee, $description, $amountMinor, $currency, $status, $propertyId, $categoryId, $deductible, $vatReclaimable, $taxCategory, $requestedBy)
          returning""" ++ cols).query[Expense].unique
  }

  def approve(id: UUID, @annotation.unused by: UUID): ConnectionIO[Int] =
    sql"update expenses set status = 'approved' where id = $id and deleted_at is null".update.run

  def reject(id: UUID, @annotation.unused by: UUID): ConnectionIO[Int] =
    sql"update expenses set status = 'rejected' where id = $id and deleted_at is null".update.run

  def get(id: UUID): ConnectionIO[Option[Expense]] =
    (fr"select" ++ cols ++ fr"from expenses where id = $id and deleted_at is null").query[Expense].option

  def list(status: Option[String]): ConnectionIO[List[Expense]] = {
    val base = fr"select" ++ cols ++ fr"from expenses where deleted_at is null"
    val filtered = status.fold(base)(s => base ++ fr"and status = $s")
    (filtered ++ fr"order by created_at desc").query[Expense].to[List]
  }

  /** F38 — (deductible total, VAT-reclaimable total, deductible count) over approved expenses. */
  def deductibleSummary: ConnectionIO[(Long, Long, Int)] =
    sql"""select coalesce(sum(amount_minor) filter (where deductible), 0),
                 coalesce(sum(amount_minor) filter (where vat_reclaimable), 0),
                 count(*) filter (where deductible)
          from expenses where deleted_at is null and status = 'approved'""".query[(Long, Long, Int)].unique
}
