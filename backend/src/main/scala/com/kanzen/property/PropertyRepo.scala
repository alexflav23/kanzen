package com.kanzen.property

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Property(id: UUID, name: String, jurisdiction: Option[String], defaultCurrency: String, status: String)
final case class Location(id: UUID, propertyId: UUID, parentId: Option[UUID], kind: String, name: String)

/** F03 — properties + typed nested location tree (Doobie). */
object PropertyRepo {
  def create(name: String, address: Option[String], jurisdiction: Option[String], currency: String): ConnectionIO[Property] =
    sql"""insert into properties (name, address, jurisdiction, default_currency)
          values ($name, $address, $jurisdiction, $currency)
          returning id, name, jurisdiction, default_currency, status""".query[Property].unique

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

  def addLocation(propertyId: UUID, parentId: Option[UUID], kind: String, name: String): ConnectionIO[Location] =
    sql"""insert into locations (property_id, parent_id, kind, name)
          values ($propertyId, $parentId, $kind, $name)
          returning id, property_id, parent_id, kind, name""".query[Location].unique

  def locations(propertyId: UUID): ConnectionIO[List[Location]] =
    sql"select id, property_id, parent_id, kind, name from locations where property_id = $propertyId and deleted_at is null"
      .query[Location].to[List]
}
