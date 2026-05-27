package com.kanzen.asset

import cats.data.NonEmptyList
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.LocalDate
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
    acquisitionDate: Option[LocalDate],
    ownershipStatus: String,
    locationId: Option[UUID],
    attributes: Json,
    custodyStatus: String,
    heroDocumentId: Option[UUID]
)

final case class Category(id: UUID, name: String, parentId: Option[UUID])

/** A resolved current-location label for the asset detail (property + node). */
final case class LocationLabel(locationName: String, propertyId: UUID, propertyName: String)

/** Append-only location-move history (newest first), with resolved names. */
final case class LocationHistoryRow(
    id: UUID,
    locationName: Option[String],
    propertyName: Option[String],
    movedBy: Option[String],
    movedAt: java.time.Instant,
    note: Option[String]
)

/** Append-only custody-change history (newest first). */
final case class CustodyHistoryRow(
    id: UUID,
    custodyStatus: String,
    changedBy: Option[String],
    changedAt: java.time.Instant,
    note: Option[String]
)

/** F04 — asset registry core. Vertical attributes are a JSONB column (not EAV). */
object AssetRepo {
  private val cols =
    fr"""id, title, maker, category_id, vertical, tracking_mode, quantity, parent_asset_id,
         acquisition_cost_minor, acquisition_currency, acquisition_date, ownership_status, location_id, attributes,
         custody_status, hero_document_id"""

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
      acquisitionDate: Option[LocalDate],
      locationId: Option[UUID],
      attributes: Json
  ): ConnectionIO[Asset] =
    (fr"""insert into assets (owner_id, title, maker, category_id, vertical, tracking_mode, quantity,
            parent_asset_id, acquisition_cost_minor, acquisition_currency, acquisition_date, location_id, attributes)
          values ($ownerId, $title, $maker, $categoryId, $vertical, $trackingMode, $quantity,
            $parentAssetId, $acquisitionCostMinor, $acquisitionCurrency, $acquisitionDate, $locationId, $attributes)
          returning""" ++ cols).query[Asset].unique

  def get(id: UUID): ConnectionIO[Option[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where id = $id and deleted_at is null").query[Asset].option

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from assets where id = $id and deleted_at is null)".query[Boolean].unique

  /** Edit the base entity's key facts (title/maker/category/status). Attributes + lineage are edited via their own
    * paths; this is the generic record edit every asset/refined-concept needs.
    */
  def update(
      id: UUID,
      title: String,
      maker: Option[String],
      categoryId: UUID,
      ownershipStatus: String
  ): ConnectionIO[Int] =
    sql"""update assets set title = $title, maker = $maker, category_id = $categoryId,
            ownership_status = $ownershipStatus, updated_at = now()
          where id = $id and deleted_at is null""".update.run

  def byCategory(categoryId: UUID): ConnectionIO[List[Asset]] =
    (fr"select" ++ cols ++ fr"from assets where category_id = $categoryId and deleted_at is null").query[Asset].to[List]

  /** Faceted list: optional category set (caller expands descendants) + a title/maker search. */
  // Asset card columns, qualified to the `a` alias (same order as `Asset`), plus the resolved property.
  private val cardCols =
    fr"""a.id, a.title, a.maker, a.category_id, a.vertical, a.tracking_mode, a.quantity, a.parent_asset_id,
         a.acquisition_cost_minor, a.acquisition_currency, a.acquisition_date, a.ownership_status, a.location_id,
         a.attributes, a.custody_status, a.hero_document_id, loc.property_id"""

  /** Faceted list for the Inventory grid. Joins locations to resolve the property (for the Property facet + value
    * rollups) and collection_members when a collection facet is applied. Returns each asset paired with its resolved
    * `property_id`.
    */
  def list(
      categoryIds: Option[NonEmptyList[UUID]],
      q: Option[String],
      vertical: Option[String] = None,
      propertyId: Option[UUID] = None,
      collectionId: Option[UUID] = None,
      status: Option[String] = None,
      ownerId: Option[UUID] = None, // F02 v2: Own-scope restriction (records I created)
      tag: Option[UUID] = None // F04: filter to assets carrying this tag (polymorphic entity_tags)
  ): ConnectionIO[List[(Asset, Option[UUID], Option[String])]] = {
    val collJoin =
      collectionId.map(_ => fr"join collection_members cm on cm.asset_id = a.id").getOrElse(Fragment.empty)
    val tagJoin =
      tag
        .map(t => fr"join entity_tags et on et.entity_type = 'asset' and et.entity_id = a.id and et.tag_id = $t")
        .getOrElse(Fragment.empty)
    // left join the hero document so each card can show its photo thumbnail (key → signed blob URL in the API layer)
    val heroJoin = fr"left join documents hd on hd.id = a.hero_document_id and hd.deleted_at is null"
    val conds: List[Fragment] = List(
      Some(fr"a.deleted_at is null"),
      categoryIds.map(ids => Fragments.in(fr"a.category_id", ids)),
      vertical.map(v => fr"a.vertical = $v"),
      propertyId.map(pid => fr"loc.property_id = $pid"),
      collectionId.map(cid => fr"cm.collection_id = $cid"),
      status.map(s => fr"a.ownership_status = $s"),
      ownerId.map(oid => fr"a.owner_id = $oid"),
      q.map(s => fr"(a.title ilike ${"%" + s + "%"} or a.maker ilike ${"%" + s + "%"})")
    ).flatten
    val where = conds.reduce((x, y) => x ++ fr"and" ++ y)
    (fr"select" ++ cardCols ++ fr", hd.s3_key from assets a left join locations loc on loc.id = a.location_id" ++
      heroJoin ++ collJoin ++ tagJoin ++ fr"where" ++ where ++ fr"order by a.title")
      .query[(Asset, Option[UUID], Option[String])]
      .to[List]
  }

  /** The creator of an asset (for F02 v2 Own-scope checks on the detail/single-record path). */
  def ownerOf(id: UUID): ConnectionIO[Option[UUID]] =
    sql"select owner_id from assets where id = $id and deleted_at is null".query[Option[UUID]].option.map(_.flatten)

  // ---- move / custody / hero (W1.4) ------------------------------------------------------------
  /** The property a location belongs to (for scope checks on a target location). */
  def propertyOfLocation(locationId: UUID): ConnectionIO[Option[UUID]] =
    sql"select property_id from locations where id = $locationId".query[UUID].option

  /** A resolved current-location label (property + node) for the asset detail. */
  def locationLabel(locationId: UUID): ConnectionIO[Option[LocationLabel]] =
    sql"""select loc.name, p.id, p.name from locations loc join properties p on p.id = loc.property_id
          where loc.id = $locationId""".query[LocationLabel].option

  /** Move the asset: update its current location AND append a history row (corrections are events). */
  def move(assetId: UUID, locationId: Option[UUID], actor: UUID, note: Option[String]): ConnectionIO[Int] =
    for {
      n <-
        sql"update assets set location_id = $locationId, updated_at = now() where id = $assetId and deleted_at is null".update.run
      _ <- sql"""insert into asset_location_history (asset_id, location_id, moved_by, note)
                 values ($assetId, $locationId, $actor, $note)""".update.run
    } yield n

  /** Change custody: update current custody AND append a history row. */
  def changeCustody(assetId: UUID, status: String, actor: UUID, note: Option[String]): ConnectionIO[Int] =
    for {
      n <-
        sql"update assets set custody_status = $status, updated_at = now() where id = $assetId and deleted_at is null".update.run
      _ <- sql"""insert into asset_custody_history (asset_id, custody_status, changed_by, note)
                 values ($assetId, $status, $actor, $note)""".update.run
    } yield n

  /** F19 — a disposal/loss lifecycle event closes the asset (sets `ownership_status`). */
  def setOwnershipStatus(assetId: UUID, status: String): ConnectionIO[Int] =
    sql"update assets set ownership_status = $status, updated_at = now() where id = $assetId and deleted_at is null".update.run

  /** Set the asset's hero photo to a document (F05). */
  def setHero(assetId: UUID, documentId: UUID): ConnectionIO[Int] =
    sql"update assets set hero_document_id = $documentId, updated_at = now() where id = $assetId and deleted_at is null".update.run

  def locationHistory(assetId: UUID): ConnectionIO[List[LocationHistoryRow]] =
    sql"""select h.id, loc.name, p.name, u.display_name, h.moved_at, h.note
          from asset_location_history h
          left join locations loc on loc.id = h.location_id
          left join properties p on p.id = loc.property_id
          left join users u on u.id = h.moved_by
          where h.asset_id = $assetId order by h.moved_at desc""".query[LocationHistoryRow].to[List]

  def custodyHistory(assetId: UUID): ConnectionIO[List[CustodyHistoryRow]] =
    sql"""select h.id, h.custody_status, u.display_name, h.changed_at, h.note
          from asset_custody_history h left join users u on u.id = h.changed_by
          where h.asset_id = $assetId order by h.changed_at desc""".query[CustodyHistoryRow].to[List]
}
