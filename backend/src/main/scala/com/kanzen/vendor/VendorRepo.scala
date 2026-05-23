package com.kanzen.vendor

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Vendor(id: UUID, name: String, trade: Option[String], insuranceUntil: Option[LocalDate])

/** F09 — vendors with property-scoped approval; selectable = approved + insured. */
object VendorRepo {
  def create(name: String, trade: Option[String], insuranceUntil: Option[LocalDate]): ConnectionIO[Vendor] =
    sql"""insert into vendors (name, trade, insurance_until)
          values ($name, $trade, $insuranceUntil)
          returning id, name, trade, insurance_until""".query[Vendor].unique

  def approveForProperty(vendorId: UUID, propertyId: UUID): ConnectionIO[Int] =
    sql"insert into vendor_property_link (vendor_id, property_id) values ($vendorId, $propertyId)".update.run

  /** Vendors approved for the property AND with current (non-expired) insurance. */
  def selectableFor(propertyId: UUID): ConnectionIO[List[Vendor]] =
    sql"""select v.id, v.name, v.trade, v.insurance_until
          from vendors v join vendor_property_link l on l.vendor_id = v.id
          where l.property_id = $propertyId and v.deleted_at is null
            and v.insurance_until is not null and v.insurance_until >= current_date""".query[Vendor].to[List]
}
