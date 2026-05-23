package com.kanzen.people

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class Person(id: UUID, name: String, role: Option[String], permitExpiry: Option[LocalDate])

/** F10 — staff records + permit-expiry surfacing. */
object PeopleRepo {
  def create(name: String, role: Option[String], jurisdiction: Option[String], permitExpiry: Option[LocalDate]): ConnectionIO[Person] =
    sql"""insert into employment_records (name, role, jurisdiction, permit_expiry)
          values ($name, $role, $jurisdiction, $permitExpiry)
          returning id, name, role, permit_expiry""".query[Person].unique

  /** Records whose permit expires within the next `withinDays` days. */
  def expiringPermits(withinDays: Int): ConnectionIO[List[Person]] =
    sql"""select id, name, role, permit_expiry from employment_records
          where permit_expiry is not null
            and permit_expiry between current_date and current_date + make_interval(days => $withinDays)
          order by permit_expiry""".query[Person].to[List]
}
