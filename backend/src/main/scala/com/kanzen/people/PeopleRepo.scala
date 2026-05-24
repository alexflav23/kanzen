package com.kanzen.people

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Person(
    id: UUID,
    userId: Option[UUID],
    name: String,
    role: Option[String],
    jurisdiction: Option[String],
    propertyId: Option[UUID],
    permitExpiry: Option[LocalDate],
    reviewDue: Option[LocalDate]
)

/** F10 — staff/HR records + permit-expiry surfacing. */
object PeopleRepo {
  private val cols = fr"id, user_id, name, role, jurisdiction, property_id, permit_expiry, review_due"

  def insert(
      ownerId: UUID,
      userId: Option[UUID],
      name: String,
      role: Option[String],
      jurisdiction: Option[String],
      propertyId: Option[UUID],
      permitExpiry: Option[LocalDate],
      reviewDue: Option[LocalDate]
  ): ConnectionIO[Person] =
    (fr"""insert into employment_records (owner_id, user_id, name, role, jurisdiction, property_id, permit_expiry, review_due)
          values ($ownerId, $userId, $name, $role, $jurisdiction, $propertyId, $permitExpiry, $reviewDue)
          returning""" ++ cols).query[Person].unique

  def list: ConnectionIO[List[Person]] =
    (fr"select" ++ cols ++ fr"from employment_records where deleted_at is null order by name").query[Person].to[List]

  def listForUser(userId: UUID): ConnectionIO[List[Person]] =
    (fr"select" ++ cols ++ fr"from employment_records where user_id = $userId and deleted_at is null")
      .query[Person]
      .to[List]

  def find(id: UUID): ConnectionIO[Option[Person]] =
    (fr"select" ++ cols ++ fr"from employment_records where id = $id and deleted_at is null").query[Person].option

  /** Records whose permit expires within the next `withinDays` days. */
  def expiringPermits(withinDays: Int): ConnectionIO[List[Person]] =
    (fr"select" ++ cols ++ fr"""from employment_records
          where deleted_at is null and permit_expiry is not null
            and permit_expiry between current_date and current_date + make_interval(days => $withinDays)
          order by permit_expiry""").query[Person].to[List]
}
