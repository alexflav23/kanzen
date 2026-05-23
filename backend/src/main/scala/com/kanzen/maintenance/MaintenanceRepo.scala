package com.kanzen.maintenance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

/** F11 — schedule maths: roll a plan forward by its frequency; is it due within the lead window? */
object MaintenanceService {
  def rollNextDue(current: LocalDate, frequency: String): LocalDate = frequency match {
    case "monthly"       => current.plusMonths(1)
    case "quarterly"     => current.plusMonths(3)
    case "semi_annually" => current.plusMonths(6)
    case "annually"      => current.plusYears(1)
    case _               => current.plusMonths(1)
  }

  def dueSoon(nextDue: LocalDate, asOf: LocalDate, leadDays: Int): Boolean =
    !nextDue.isAfter(asOf.plusDays(leadDays.toLong))
}

final case class Plan(id: UUID, frequency: String, nextDue: Option[LocalDate])

object MaintenanceRepo {
  def createPlan(frequency: String, firstDue: LocalDate, leadDays: Int): ConnectionIO[Plan] =
    sql"""insert into maintenance_plans (frequency, next_due, lead_days) values ($frequency, $firstDue, $leadDays)
          returning id, frequency, next_due""".query[Plan].unique

  /** Complete a service: write a log and roll next_due forward. Returns the new next_due. */
  def complete(planId: UUID, performedOn: LocalDate, costMinor: Option[Long]): ConnectionIO[LocalDate] =
    for {
      cur <- sql"select frequency, next_due from maintenance_plans where id = $planId".query[(String, LocalDate)].unique
      next = MaintenanceService.rollNextDue(cur._2, cur._1)
      _ <- sql"insert into maintenance_logs (plan_id, performed_on, cost_minor) values ($planId, $performedOn, $costMinor)".update.run
      _ <- sql"update maintenance_plans set next_due = $next where id = $planId".update.run
    } yield next

  def get(planId: UUID): ConnectionIO[Option[Plan]] =
    sql"select id, frequency, next_due from maintenance_plans where id = $planId".query[Plan].option
}
