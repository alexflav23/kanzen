package com.kanzen.people

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

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
    reviewDue: Option[LocalDate],
    contractType: Option[String],
    startDate: Option[LocalDate],
    endDate: Option[LocalDate],
    workPermitNo: Option[String],
    emergencyContacts: Json,
    payrollRef: Option[String],
    notes: Option[String]
)

/** F02 v2 — a Staff member's record-level scope: the person row that *is* them (`personId`, the assignee id space) +
  * their property. Tasks/Lists scope a Staff viewer to "assigned to me, or unassigned in my property".
  */
final case class AssigneeScope(personId: UUID, propertyId: Option[UUID])

/** F10 — staff/HR records + permit-expiry surfacing. */
object PeopleRepo {

  /** Resolve the signed-in user's own person row → their assignee-scope (none if they have no employment record). */
  def assigneeScope(userId: UUID): ConnectionIO[Option[AssigneeScope]] =
    sql"""select id, property_id from employment_records
          where user_id = $userId and deleted_at is null order by created_at limit 1"""
      .query[AssigneeScope]
      .option

  private val cols =
    fr"""id, user_id, name, role, jurisdiction, property_id, permit_expiry, review_due,
         contract_type, start_date, end_date, work_permit_no, emergency_contacts, payroll_ref, notes"""

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
