package com.kanzen.property

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Property(id: UUID, name: String, jurisdiction: Option[String], defaultCurrency: String, status: String)
final case class Location(
  id: UUID, propertyId: UUID, parentId: Option[UUID], kind: String, name: String,
  floor: Option[String], area: Option[String], notes: Option[String], sortOrder: Int,
)

/** F03 — properties + typed nested location tree (Doobie). */
object PropertyRepo {
  def create(name: String, address: Option[String], jurisdiction: Option[String], currency: String): ConnectionIO[Property] =
    sql"""insert into properties (name, address, jurisdiction, default_currency)
          values ($name, $address, $jurisdiction, $currency)
          returning id, name, jurisdiction, default_currency, status""".query[Property].unique

  /** Full create with owner (house rule) + type/ownership — the API path. */
  def insert(ownerId: UUID, name: String, address: Option[String], jurisdiction: Option[String],
             propType: Option[String], ownership: Option[String], currency: String): ConnectionIO[Property] =
    sql"""insert into properties (owner_id, name, address, jurisdiction, type, ownership, default_currency)
          values ($ownerId, $name, $address, $jurisdiction, $propType, $ownership, $currency)
          returning id, name, jurisdiction, default_currency, status""".query[Property].unique

  def findProperty(id: UUID): ConnectionIO[Option[Property]] =
    sql"select id, name, jurisdiction, default_currency, status from properties where id = $id and deleted_at is null"
      .query[Property].option

  def patchProperty(id: UUID, name: String, address: Option[String], jurisdiction: Option[String],
                    propType: Option[String], ownership: Option[String]): ConnectionIO[Int] =
    sql"""update properties set name = $name, address = $address, jurisdiction = $jurisdiction,
            type = $propType, ownership = $ownership, updated_at = now()
          where id = $id and deleted_at is null""".update.run

  def archive(id: UUID): ConnectionIO[Int] =
    sql"update properties set status = 'archived', updated_at = now() where id = $id and deleted_at is null".update.run

  def list: ConnectionIO[List[Property]] =
    sql"select id, name, jurisdiction, default_currency, status from properties where deleted_at is null order by name"
      .query[Property].to[List]

  /** Properties visible to a principal under F02 scope: all of them when the user has no
    * scope rows, otherwise only the scoped ones. */
  def listForPrincipal(userId: UUID): ConnectionIO[List[Property]] =
    sql"""select id, name, jurisdiction, default_currency, status
          from properties p
          where p.deleted_at is null
            and (not exists (select 1 from user_property_scopes s where s.user_id = $userId)
                 or exists (select 1 from user_property_scopes s
                            where s.user_id = $userId and s.property_id = p.id))
          order by name""".query[Property].to[List]

  /** Number of (live) locations under a property — the "rooms" count on the Bible. */
  def locationCount(propertyId: UUID): ConnectionIO[Int] =
    sql"select count(*) from locations where property_id = $propertyId and deleted_at is null".query[Int].unique

  private val locCols =
    fr"id, property_id, parent_id, kind, name, floor, area, notes, sort_order"

  /** Convenience insert (no detail) — used by tests/seed. */
  def addLocation(propertyId: UUID, parentId: Option[UUID], kind: String, name: String): ConnectionIO[Location] =
    (fr"""insert into locations (property_id, parent_id, kind, name)
          values ($propertyId, $parentId, $kind, $name)
          returning""" ++ locCols).query[Location].unique

  /** Full insert with detail + owner (the API path; owner_id per the house rule). */
  def insertLocation(ownerId: UUID, propertyId: UUID, parentId: Option[UUID], kind: String, name: String,
                     floor: Option[String], area: Option[String], notes: Option[String]): ConnectionIO[Location] =
    (fr"""insert into locations (owner_id, property_id, parent_id, kind, name, floor, area, notes)
          values ($ownerId, $propertyId, $parentId, $kind, $name, $floor, $area, $notes)
          returning""" ++ locCols).query[Location].unique

  def locations(propertyId: UUID): ConnectionIO[List[Location]] =
    (fr"select" ++ locCols ++ fr"from locations where property_id = $propertyId and deleted_at is null order by sort_order, name")
      .query[Location].to[List]

  def findLocation(id: UUID): ConnectionIO[Option[Location]] =
    (fr"select" ++ locCols ++ fr"from locations where id = $id and deleted_at is null").query[Location].option

  def renameLocation(id: UUID, name: String, notes: Option[String], floor: Option[String], area: Option[String]): ConnectionIO[Int] =
    sql"""update locations set name = $name, notes = $notes, floor = $floor, area = $area, updated_at = now()
          where id = $id and deleted_at is null""".update.run

  def reparent(id: UUID, newParent: Option[UUID]): ConnectionIO[Int] =
    sql"update locations set parent_id = $newParent, updated_at = now() where id = $id and deleted_at is null".update.run

  def childCount(id: UUID): ConnectionIO[Int] =
    sql"select count(*) from locations where parent_id = $id and deleted_at is null".query[Int].unique

  def softDeleteLocation(id: UUID): ConnectionIO[Int] =
    sql"update locations set deleted_at = now() where id = $id and deleted_at is null".update.run
}
