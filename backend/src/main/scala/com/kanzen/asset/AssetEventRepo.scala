package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class AssetEvent(
    id: UUID,
    assetId: UUID,
    eventType: String,
    occurredAt: String,
    costMinor: Option[Long],
    currency: Option[String],
    note: Option[String],
    party: Option[String],
)

/** F19 — asset lifecycle events + lifetime-cost rollup (acquisition + operating). */
object AssetEventRepo {
  // occurred_at as text avoids a timestamp Meta dependency; events render newest-first.
  private val cols = fr"id, asset_id, type, occurred_at::text, cost_minor, currency, note, party"

  def add(assetId: UUID, eventType: String, costMinor: Option[Long], currency: Option[String], note: Option[String]): ConnectionIO[AssetEvent] =
    (fr"""insert into asset_events (asset_id, type, cost_minor, currency, note)
          values ($assetId, $eventType, $costMinor, $currency, $note)
          returning""" ++ cols).query[AssetEvent].unique

  def timeline(assetId: UUID): ConnectionIO[List[AssetEvent]] =
    (fr"select" ++ cols ++ fr"from asset_events where asset_id = $assetId order by occurred_at desc").query[AssetEvent].to[List]

  /** Lifetime cost = sum of all cost-bearing events (acquisition modelled as an 'acquired' event). */
  def lifetimeCostMinor(assetId: UUID): ConnectionIO[Long] =
    sql"select coalesce(sum(cost_minor), 0) from asset_events where asset_id = $assetId".query[Long].unique
}
