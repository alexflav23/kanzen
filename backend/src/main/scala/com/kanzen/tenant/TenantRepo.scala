package com.kanzen.tenant

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F45/F46 — tenant persistence + the onboarding state-machine row. */
object TenantRepo {
  def slugTaken(slug: String): ConnectionIO[Boolean] =
    sql"select exists(select 1 from tenants where slug = $slug)".query[Boolean].unique

  def create(slug: String, name: String): ConnectionIO[UUID] =
    sql"insert into tenants (slug, name) values ($slug, $name) returning id".query[UUID].unique

  def setPrincipal(tenantId: UUID, userId: UUID): ConnectionIO[Int] =
    sql"update tenants set principal_user_id = $userId where id = $tenantId".update.run

  /** Seed the onboarding row at the given first step (idempotent). */
  def initSetup(tenantId: UUID, firstStep: String): ConnectionIO[Int] =
    sql"""insert into tenant_setup (tenant_id, current_step) values ($tenantId, $firstStep)
          on conflict (tenant_id) do nothing""".update.run

  /** (current_step, completed?) for the Dashboard banner; None if the tenant has no setup row. */
  def setupState(tenantId: UUID): ConnectionIO[Option[(Option[String], Boolean)]] =
    sql"select current_step, (completed_at is not null) from tenant_setup where tenant_id = $tenantId"
      .query[(Option[String], Boolean)]
      .option

  /** F46 — the canonical onboarding step order (matches the spec §3). `account` is implicit at signup. */
  val stepOrder: List[String] =
    List("verify_email", "workspace", "first_property", "initial_people", "mailboxes", "optional_integrations", "tour")

  /** Mark `step` done and advance `current_step` to the next; completing the last step (`tour`) stamps `completed_at`
    * (so the Dashboard banner disappears). Marking a step done is idempotent — re-advancing the same step is harmless.
    */
  def advance(tenantId: UUID, step: String): ConnectionIO[Int] = {
    val next = stepOrder.dropWhile(_ != step).drop(1).headOption
    next match {
      case Some(n) =>
        sql"""update tenant_setup
              set steps_done = steps_done || jsonb_build_object($step, now()::text),
                  current_step = $n, updated_at = now()
              where tenant_id = $tenantId""".update.run
      case None =>
        sql"""update tenant_setup
              set steps_done = steps_done || jsonb_build_object($step, now()::text),
                  current_step = null, completed_at = now(), updated_at = now()
              where tenant_id = $tenantId""".update.run
    }
  }
}
