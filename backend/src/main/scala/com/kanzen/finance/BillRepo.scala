package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Bill(
    id: UUID,
    payee: String,
    amountMinor: Long,
    currency: String,
    varianceFlag: Boolean,
    propertyId: Option[UUID],
    category: Option[String]
)

/** F15 — recurring bills; `recordSeen` applies a newly-observed amount (e.g. from the agent's invoice reconciliation)
  * and flags a >= ±15% variance vs the prior amount.
  */
object BillRepo {
  private val cols = fr"id, payee, amount_minor, currency, variance_flag, property_id, category"

  def create(
      tenantId: UUID,
      payee: String,
      propertyId: Option[UUID],
      category: Option[String],
      amountMinor: Long,
      currency: String,
      frequency: Option[String]
  ): ConnectionIO[Bill] =
    (fr"""insert into bills (tenant_id, payee, property_id, category, amount_minor, currency, frequency)
          values ($tenantId, $payee, $propertyId, $category, $amountMinor, $currency, $frequency)
          returning""" ++ cols).query[Bill].unique

  def recordSeen(id: UUID, seenMinor: Long): ConnectionIO[Boolean] =
    for {
      cur <- sql"select last_seen_minor, amount_minor from bills where id = $id".query[(Option[Long], Long)].unique
      prev = cur._1.getOrElse(cur._2)
      flag = BillService.isVariance(prev, seenMinor)
      _ <- sql"""update bills set prev_seen_minor = $prev, last_seen_minor = $seenMinor,
                 amount_minor = $seenMinor, variance_flag = $flag where id = $id""".update.run
    } yield flag

  def get(id: UUID, tenantId: UUID): ConnectionIO[Option[Bill]] =
    (fr"select" ++ cols ++ fr"from bills where id = $id and tenant_id = $tenantId").query[Bill].option

  def list(tenantId: UUID): ConnectionIO[List[Bill]] =
    (fr"select" ++ cols ++ fr"from bills where deleted_at is null and active and tenant_id = $tenantId order by next_due nulls last")
      .query[Bill]
      .to[List]
}
