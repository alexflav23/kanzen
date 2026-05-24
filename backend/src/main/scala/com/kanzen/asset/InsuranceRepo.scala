package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

/** F21 — warranty expiry window. */
object ProvenanceService {
  def warrantyExpiringSoon(endsOn: Option[LocalDate], asOf: LocalDate, days: Int): Boolean =
    endsOn.exists(d => !d.isBefore(asOf) && !d.isAfter(asOf.plusDays(days.toLong)))
}

final case class Insurance(
    insured: Boolean,
    policyRef: Option[String],
    insurer: Option[String],
    insuredValueMinor: Option[Long],
    renewalOn: Option[LocalDate]
)
final case class Warranty(id: UUID, provider: Option[String], startsOn: Option[LocalDate], endsOn: Option[LocalDate])

object InsuranceRepo {
  def set(
      assetId: UUID,
      insured: Boolean,
      policyRef: Option[String],
      insuredValueMinor: Option[Long],
      renewalOn: Option[LocalDate],
      insurer: Option[String] = None
  ): ConnectionIO[Int] =
    sql"""insert into asset_insurance (asset_id, insured, policy_ref, insurer, insured_value_minor, renewal_on)
          values ($assetId, $insured, $policyRef, $insurer, $insuredValueMinor, $renewalOn)""".update.run

  def get(assetId: UUID): ConnectionIO[Option[Insurance]] =
    sql"""select insured, policy_ref, insurer, insured_value_minor, renewal_on from asset_insurance
          where asset_id = $assetId order by created_at desc limit 1""".query[Insurance].option

  def addWarranty(
      assetId: UUID,
      provider: Option[String],
      endsOn: Option[LocalDate],
      startsOn: Option[LocalDate] = None
  ): ConnectionIO[Int] =
    sql"insert into asset_warranties (asset_id, provider, starts_on, ends_on) values ($assetId, $provider, $startsOn, $endsOn)".update.run

  def warranties(assetId: UUID): ConnectionIO[List[Warranty]] =
    sql"select id, provider, starts_on, ends_on from asset_warranties where asset_id = $assetId order by ends_on desc nulls last"
      .query[Warranty]
      .to[List]
}
