package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Valuation(id: UUID, assetId: UUID, kind: String, amountMinor: Long, currency: String, valuedAt: String)

/** F20 — dated valuation snapshots; current value = latest-by-kind. */
object ValuationRepo {
  private val cols = fr"id, asset_id, kind, amount_minor, currency, valued_at::text"

  def add(
      assetId: UUID,
      kind: String,
      amountMinor: Long,
      currency: String,
      source: Option[String]
  ): ConnectionIO[Valuation] =
    (fr"""insert into asset_valuation_snapshots (asset_id, kind, amount_minor, currency, source)
          values ($assetId, $kind, $amountMinor, $currency, $source)
          returning""" ++ cols).query[Valuation].unique

  def latest(assetId: UUID, kind: String): ConnectionIO[Option[Valuation]] =
    (fr"select" ++ cols ++ fr"""from asset_valuation_snapshots
          where asset_id = $assetId and kind = $kind order by valued_at desc, created_at desc limit 1""")
      .query[Valuation]
      .option

  def history(assetId: UUID): ConnectionIO[List[Valuation]] =
    (fr"select" ++ cols ++ fr"from asset_valuation_snapshots where asset_id = $assetId order by valued_at desc")
      .query[Valuation]
      .to[List]
}
