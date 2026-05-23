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

final case class Insurance(insured: Boolean, policyRef: Option[String], insuredValueMinor: Option[Long])

object InsuranceRepo {
  def set(assetId: UUID, insured: Boolean, policyRef: Option[String], insuredValueMinor: Option[Long], renewalOn: Option[LocalDate]): ConnectionIO[Int] =
    sql"""insert into asset_insurance (asset_id, insured, policy_ref, insured_value_minor, renewal_on)
          values ($assetId, $insured, $policyRef, $insuredValueMinor, $renewalOn)""".update.run

  def get(assetId: UUID): ConnectionIO[Option[Insurance]] =
    sql"select insured, policy_ref, insured_value_minor from asset_insurance where asset_id = $assetId order by created_at desc limit 1"
      .query[Insurance].option

  def addWarranty(assetId: UUID, provider: Option[String], endsOn: Option[LocalDate]): ConnectionIO[Int] =
    sql"insert into asset_warranties (asset_id, provider, ends_on) values ($assetId, $provider, $endsOn)".update.run
}
