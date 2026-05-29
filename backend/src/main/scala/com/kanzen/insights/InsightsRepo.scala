package com.kanzen.insights

import doobie._
import doobie.implicits._

/** F29 — aggregate reporting (native-currency; cross-currency rollups via F37). */
object InsightsRepo {

  /** Sum of each asset's latest 'market' valuation. */
  def totalMarketValueMinor: ConnectionIO[Long] =
    sql"""select coalesce(sum(v.amount_minor), 0) from (
            select distinct on (asset_id) asset_id, amount_minor
            from asset_valuation_snapshots where kind = 'market'
            order by asset_id, valued_at desc, created_at desc
          ) v""".query[Long].unique

  /** Sum of approved expenses. */
  def totalApprovedExpensesMinor: ConnectionIO[Long] =
    sql"select coalesce(sum(amount_minor), 0) from expenses where status = 'approved'".query[Long].unique

  def assetTotal: ConnectionIO[Long] =
    sql"select count(*) from assets where deleted_at is null".query[Long].unique

  /** Lifetime spend = acquisition cost across the registry + operating (lifecycle-event) costs. */
  def lifetimeSpendMinor: ConnectionIO[Long] =
    sql"""select coalesce((select sum(acquisition_cost_minor) from assets where deleted_at is null), 0)
          + coalesce((select sum(cost_minor) from asset_events), 0)""".query[Long].unique

  /** Acquisition value grouped by category (the real basis for "spend by category"). */
  def valueByCategory: ConnectionIO[List[(String, Long)]] =
    sql"""select c.name, coalesce(sum(a.acquisition_cost_minor), 0)
          from assets a join categories c on c.id = a.category_id
          where a.deleted_at is null and a.acquisition_cost_minor is not null
          group by c.name having coalesce(sum(a.acquisition_cost_minor), 0) > 0
          order by 2 desc""".query[(String, Long)].to[List]

  /** Top assets by acquisition value. */
  def topAssets(limit: Int): ConnectionIO[List[(String, Option[String], Long)]] =
    sql"""select title, maker, coalesce(acquisition_cost_minor, 0)
          from assets where deleted_at is null and acquisition_cost_minor is not null
          order by acquisition_cost_minor desc limit $limit""".query[(String, Option[String], Long)].to[List]

  /** F29 — approved-expense spend per month per currency over the last 12 months (native, no FX). */
  def spendByMonth: ConnectionIO[List[(String, String, Long)]] =
    sql"""select to_char(date_trunc('month', coalesce(incurred_on, created_at::date)), 'YYYY-MM') as m,
                 currency, coalesce(sum(amount_minor), 0)
          from expenses
          where status = 'approved'
            and coalesce(incurred_on, created_at::date) >= date_trunc('month', current_date) - interval '11 months'
          group by m, currency order by m""".query[(String, String, Long)].to[List]
}
