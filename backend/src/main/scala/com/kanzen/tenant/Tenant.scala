package com.kanzen.tenant

import java.util.UUID

/** F45 — multi-tenancy. Every domain row carries a `tenant_id`; reads/writes are constrained to the caller's tenant.
  * During the rollout (and forever for the single-household sandbox) the seeded `default` tenant is the fallback for
  * any token without a `custom:tenant_id` claim, matching the V4_0_0 DB default.
  */
object Tenant {

  /** The seeded `default` tenant (slug `default`) — the Carter household. Mirrors the V4_0_0 migration constant. */
  val DefaultId: UUID = UUID.fromString("7e000000-0000-0000-0000-000000000001")
}
