package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class AssetEvent(id: UUID, assetId: UUID, eventType: String, costMinor: Option[Long], currency: Option[String])

/** F19 — asset lifecycle events + lifetime-cost rollup (acquisition + operating). */
object AssetEventRepo {
  def add(assetId: UUID, eventType: String, costMinor: Option[Long], currency: Option[String], note: Option[String]): ConnectionIO[AssetEvent] =
    sql"""insert into asset_events (asset_id, type, cost_minor, currency, note)
          values ($assetId, $eventType, $costMinor, $currency, $note)
          returning id, asset_id, type, cost_minor, currency""".query[AssetEvent].unique

  def timeline(assetId: UUID): ConnectionIO[List[AssetEvent]] =
    sql"select id, asset_id, type, cost_minor, currency from asset_events where asset_id = $assetId order by occurred_at desc"
      .query[AssetEvent].to[List]

  /** Lifetime cost = sum of all cost-bearing events (acquisition modelled as an 'acquired' event). */
  def lifetimeCostMinor(assetId: UUID): ConnectionIO[Long] =
    sql"select coalesce(sum(cost_minor), 0) from asset_events where asset_id = $assetId".query[Long].unique
}
