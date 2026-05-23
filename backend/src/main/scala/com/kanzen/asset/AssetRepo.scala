package com.kanzen.asset

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
    trackingMode: String,
    quantity: Int,
    attributes: Json,
    ownershipStatus: String,
)

/** F04 — asset registry core. Vertical attributes are a JSONB column (not EAV). */
object AssetRepo {
  private val cols = fr"id, title, maker, category_id, tracking_mode, quantity, attributes, ownership_status"

  def createCategory(name: String, parentId: Option[UUID]): ConnectionIO[UUID] =
    sql"insert into categories (name, parent_id) values ($name, $parentId) returning id".query[UUID].unique

  def create(
      title: String,
      maker: Option[String],
      categoryId: UUID,
      trackingMode: String,
      quantity: Int,
      attributes: Json,
  ): ConnectionIO[Asset] =
    (fr"""insert into assets (title, maker, category_id, tracking_mode, quantity, attributes)
          values ($title, $maker, $categoryId, $trackingMode, $quantity, $attributes)
          returning""" ++ cols).query[Asset].unique

  def get(id: UUID): ConnectionIO[Option[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where id = $id").query[Asset].option

  def byCategory(categoryId: UUID): ConnectionIO[List[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where category_id = $categoryId and deleted_at is null").query[Asset].to[List]
}
