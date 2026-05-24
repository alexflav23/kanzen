package com.kanzen.property

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Defect(
  id: UUID, propertyId: UUID, locationId: Option[UUID], title: String,
  description: Option[String], severity: String, status: String, reportedBy: Option[UUID],
)

/** F03 — property defects (a first-class entity). Lifecycle open → in_progress →
  * resolved|wont_fix; `resolved_at` is set on resolve and cleared on reopen. */
object DefectRepo {
  private val cols = fr"id, property_id, location_id, title, description, severity, status, reported_by"

  def raise(ownerId: UUID, propertyId: UUID, locationId: Option[UUID], title: String,
            description: Option[String], severity: String, reportedBy: UUID): ConnectionIO[Defect] =
    (fr"""insert into defects (owner_id, property_id, location_id, title, description, severity, reported_by)
          values ($ownerId, $propertyId, $locationId, $title, $description, $severity, $reportedBy)
          returning""" ++ cols).query[Defect].unique

  def list(propertyId: UUID, status: Option[String]): ConnectionIO[List[Defect]] = {
    val base     = fr"select" ++ cols ++ fr"from defects where property_id = $propertyId and deleted_at is null"
    val filtered = status.fold(base)(s => base ++ fr"and status = $s")
    (filtered ++ fr"order by created_at desc").query[Defect].to[List]
  }

  def find(id: UUID): ConnectionIO[Option[Defect]] =
    (fr"select" ++ cols ++ fr"from defects where id = $id and deleted_at is null").query[Defect].option

  /** Transition status; set `resolved_at` on resolve, clear it on any reopen. */
  def setStatus(id: UUID, status: String): ConnectionIO[Int] =
    sql"""update defects
          set status = $status,
              resolved_at = case when $status = 'resolved' then now() else null end,
              updated_at = now()
          where id = $id and deleted_at is null""".update.run

  def resolvedAtSet(id: UUID): ConnectionIO[Boolean] =
    sql"select resolved_at is not null from defects where id = $id".query[Boolean].unique

  def patch(id: UUID, title: String, description: Option[String], severity: String): ConnectionIO[Int] =
    sql"""update defects set title = $title, description = $description, severity = $severity, updated_at = now()
          where id = $id and deleted_at is null""".update.run
}
