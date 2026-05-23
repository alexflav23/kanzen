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
}
