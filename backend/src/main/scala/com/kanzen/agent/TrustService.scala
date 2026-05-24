package com.kanzen.agent

import doobie._
import doobie.implicits._

/** F27 — agent trust routing. Financial/asset-creation categories are LOCKED to review and can never be auto-executed,
  * regardless of the requested routing (SPEC §10.3).
  */
object TrustService {
  val financialCategories: Set[String] = Set("Bill / Invoice", "Receipt", "Asset")

  def locked(category: String): Boolean = financialCategories.contains(category)

  def effectiveRouting(category: String, requested: String): String =
    if (locked(category)) "review" else requested

  def canAutoExecute(category: String, requestedRouting: String): Boolean =
    !locked(category) && effectiveRouting(category, requestedRouting) == "auto"
}

object TrustRepo {

  /** Set a category's routing; financial categories are forced to 'review'. Returns the effective routing. */
  def set(category: String, requested: String): ConnectionIO[String] = {
    val eff = TrustService.effectiveRouting(category, requested)
    val isLocked = TrustService.locked(category)
    sql"""insert into trust_settings (category, routing, locked) values ($category, $eff, $isLocked)
          on conflict (category) do update set routing = excluded.routing, locked = excluded.locked
          returning routing""".query[String].unique
  }

  def get(category: String): ConnectionIO[Option[String]] =
    sql"select routing from trust_settings where category = $category".query[String].option

  def all: ConnectionIO[List[(String, String, Boolean)]] =
    sql"select category, routing, locked from trust_settings order by category"
      .query[(String, String, Boolean)]
      .to[List]
}
