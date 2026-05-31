package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** A budget plus its computed actual spend (approved expenses in the period) + resolved property/category names. */
final case class BudgetRow(
    id: UUID,
    propertyId: Option[UUID],
    categoryId: Option[UUID],
    period: String,
    amountMinor: Long,
    currency: String,
    actualMinor: Long,
    propertyName: Option[String],
    categoryName: Option[String]
)

/** F17 — per-property/category budgets with budget-vs-actual. Actual = SUM(approved expenses) in the current period
  * window (monthly/quarterly/annually) matching the budget's property + category scope; same-currency (no FX).
  */
object BudgetRepo {
  private val PERIODS = Set("monthly", "quarterly", "annually")
  def validPeriod(p: String): Boolean = PERIODS.contains(p)

  /** All budgets with their actuals (newest first). */
  def list: ConnectionIO[List[BudgetRow]] =
    sql"""
      select b.id, b.property_id, b.category_id, b.period, b.amount_minor, b.currency,
        coalesce((
          select sum(e.amount_minor) from expenses e
          where e.deleted_at is null and e.status = 'approved' and e.currency = b.currency
            and (b.property_id is null or e.property_id = b.property_id)
            and (b.category_id is null or e.category_id = b.category_id)
            and coalesce(e.incurred_on, e.created_at::date) >= date_trunc(
              case b.period when 'annually' then 'year' when 'quarterly' then 'quarter' else 'month' end,
              current_date)::date
        ), 0) as actual_minor,
        p.name, c.name
      from budgets b
      left join properties p on p.id = b.property_id
      left join categories c on c.id = b.category_id
      where b.deleted_at is null
      order by b.created_at
    """.query[BudgetRow].to[List]

  def create(
      ownerId: UUID,
      propertyId: Option[UUID],
      categoryId: Option[UUID],
      period: String,
      amountMinor: Long,
      currency: String,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"""insert into budgets (tenant_id, owner_id, property_id, category_id, period, amount_minor, currency)
          values ($tenantId, $ownerId, $propertyId, $categoryId, $period, $amountMinor, $currency)
          returning id""".query[UUID].unique

  def find(id: UUID): ConnectionIO[Option[BudgetRow]] = list.map(_.find(_.id == id))

  def softDelete(id: UUID): ConnectionIO[Int] =
    sql"update budgets set deleted_at = now() where id = $id and deleted_at is null".update.run
}
