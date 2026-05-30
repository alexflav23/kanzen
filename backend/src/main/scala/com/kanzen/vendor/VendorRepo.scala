package com.kanzen.vendor

import cats.data.NonEmptyList
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Vendor(
    id: UUID,
    name: String,
    `type`: String,
    trade: Option[String],
    ndaUntil: Option[LocalDate],
    insuranceUntil: Option[LocalDate],
    rating: Option[BigDecimal]
)

/** F09 — vendors with property-scoped approval; selectable = approved + insured. */
object VendorRepo {
  private val cols = fr"id, name, type, trade, nda_until, insurance_until, rating"

  def create(name: String, trade: Option[String], insuranceUntil: Option[LocalDate]): ConnectionIO[Vendor] =
    (fr"""insert into vendors (name, trade, insurance_until) values ($name, $trade, $insuranceUntil)
          returning""" ++ cols).query[Vendor].unique

  def insert(
      ownerId: UUID,
      tenantId: UUID,
      name: String,
      vtype: String,
      trade: Option[String],
      ndaUntil: Option[LocalDate],
      insuranceUntil: Option[LocalDate],
      rating: Option[BigDecimal]
  ): ConnectionIO[Vendor] =
    (fr"""insert into vendors (owner_id, tenant_id, name, type, trade, nda_until, insurance_until, rating)
          values ($ownerId, $tenantId, $name, $vtype, $trade, $ndaUntil, $insuranceUntil, $rating)
          returning""" ++ cols).query[Vendor].unique

  def find(id: UUID, tenantId: UUID): ConnectionIO[Option[Vendor]] =
    (fr"select" ++ cols ++ fr"from vendors where id = $id and tenant_id = $tenantId and deleted_at is null")
      .query[Vendor]
      .option

  def listAll(tenantId: UUID): ConnectionIO[List[Vendor]] =
    (fr"select" ++ cols ++ fr"from vendors where deleted_at is null and tenant_id = $tenantId order by name")
      .query[Vendor]
      .to[List]

  /** Vendors approved for any of the given properties (Staff scope). */
  def listForProperties(propertyIds: NonEmptyList[UUID]): ConnectionIO[List[Vendor]] =
    (fr"select distinct" ++ cols ++ fr"""from vendors v join vendor_property_link l on l.vendor_id = v.id
          where""" ++ Fragments.in(fr"l.property_id", propertyIds) ++ fr"and v.deleted_at is null order by v.name")
      .query[Vendor]
      .to[List]

  def propertiesOf(vendorId: UUID): ConnectionIO[List[UUID]] =
    sql"select property_id from vendor_property_link where vendor_id = $vendorId".query[UUID].to[List]

  def approveForProperty(vendorId: UUID, propertyId: UUID): ConnectionIO[Int] =
    sql"insert into vendor_property_link (vendor_id, property_id) values ($vendorId, $propertyId) on conflict do nothing".update.run

  /** Vendors approved for the property AND with current (non-expired) insurance. */
  def selectableFor(propertyId: UUID): ConnectionIO[List[Vendor]] =
    (fr"select" ++ cols ++ fr"""from vendors v join vendor_property_link l on l.vendor_id = v.id
          where l.property_id = $propertyId and v.deleted_at is null
            and v.insurance_until is not null and v.insurance_until >= current_date order by v.name""")
      .query[Vendor]
      .to[List]
}
