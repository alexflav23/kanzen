package com.kanzen.asset

import cats.data.NonEmptyList
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

final case class Asset(
    id: UUID,
    title: String,
    maker: Option[String],
    categoryId: Option[UUID],
    vertical: Option[String],
    trackingMode: String,
    quantity: Int,
    parentAssetId: Option[UUID],
    acquisitionCostMinor: Option[Long],
    acquisitionCurrency: Option[String],
    ownershipStatus: String,
    locationId: Option[UUID],
    attributes: Json
)

final case class Category(id: UUID, name: String, parentId: Option[UUID])

/** F04 — asset registry core. Vertical attributes are a JSONB column (not EAV). */
object AssetRepo {
  private val cols =
    fr"""id, title, maker, category_id, vertical, tracking_mode, quantity, parent_asset_id,
         acquisition_cost_minor, acquisition_currency, ownership_status, location_id, attributes"""

  def createCategory(name: String, parentId: Option[UUID]): ConnectionIO[UUID] =
    sql"insert into categories (name, parent_id) values ($name, $parentId) returning id".query[UUID].unique

  def listCategories: ConnectionIO[List[Category]] =
    sql"select id, name, parent_id from categories where deleted_at is null order by sort_order, name"
      .query[Category]
      .to[List]

  def categoryExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from categories where id = $id and deleted_at is null)".query[Boolean].unique

  /** A category and all its descendants (for faceted filtering by a parent category). */
  def categoryDescendants(id: UUID): ConnectionIO[List[UUID]] =
    sql"""with recursive sub as (
            select id from categories where id = $id and deleted_at is null
            union all
            select c.id from categories c join sub on c.parent_id = sub.id where c.deleted_at is null
          )
          select id from sub""".query[UUID].to[List]

  /** Convenience create (no owner/detail) — used by existing tests/seed. */
  def create(
      title: String,
      maker: Option[String],
      categoryId: UUID,
      trackingMode: String,
      quantity: Int,
      attributes: Json
  ): ConnectionIO[Asset] =
    (fr"""insert into assets (title, maker, category_id, tracking_mode, quantity, attributes)
          values ($title, $maker, $categoryId, $trackingMode, $quantity, $attributes)
          returning""" ++ cols).query[Asset].unique

  /** Full create with owner (house rule) + tracking/parent/acquisition/location — the API path. */
  def insert(
      ownerId: UUID,
      title: String,
      maker: Option[String],
      categoryId: UUID,
      vertical: Option[String],
      trackingMode: String,
      quantity: Int,
      parentAssetId: Option[UUID],
      acquisitionCostMinor: Option[Long],
      acquisitionCurrency: Option[String],
      locationId: Option[UUID],
      attributes: Json
  ): ConnectionIO[Asset] =
    (fr"""insert into assets (owner_id, title, maker, category_id, vertical, tracking_mode, quantity,
            parent_asset_id, acquisition_cost_minor, acquisition_currency, location_id, attributes)
          values ($ownerId, $title, $maker, $categoryId, $vertical, $trackingMode, $quantity,
            $parentAssetId, $acquisitionCostMinor, $acquisitionCurrency, $locationId, $attributes)
          returning""" ++ cols).query[Asset].unique

  def get(id: UUID): ConnectionIO[Option[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where id = $id and deleted_at is null").query[Asset].option

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from assets where id = $id and deleted_at is null)".query[Boolean].unique

  def byCategory(categoryId: UUID): ConnectionIO[List[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where category_id = $categoryId and deleted_at is null").query[Asset].to[List]

  /** Faceted list: optional category set (caller expands descendants) + a title/maker search. */
  def list(
      categoryIds: Option[NonEmptyList[UUID]],
      q: Option[String],
      vertical: Option[String] = None
  ): ConnectionIO[List[Asset]] = {
    val conds: List[Fragment] = List(
      Some(fr"deleted_at is null"),
      categoryIds.map(ids => Fragments.in(fr"category_id", ids)),
      vertical.map(v => fr"vertical = $v"),
      q.map(s => fr"(title ilike ${"%" + s + "%"} or maker ilike ${"%" + s + "%"})")
    ).flatten
    val where = conds.reduce((a, b) => a ++ fr"and" ++ b)
    (fr"select" ++ cols ++ fr"from assets where" ++ where ++ fr"order by title").query[Asset].to[List]
  }
}
