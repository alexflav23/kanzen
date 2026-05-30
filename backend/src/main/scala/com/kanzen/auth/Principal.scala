package com.kanzen.auth

import com.kanzen.tenant.Tenant

import java.util.UUID

/** The authenticated caller, resolved to a canonical Kanzen user (F01). `userId` is the `users.id` (owns rows, scopes
  * authz); `role` is the DB role (authoritative — the JWT claim is only a hint). `subject` is the Cognito sub, kept for
  * audit. `impersonatedBy` is set when an admin is acting-as this user (the impersonation engine) — the *effective*
  * principal is this user; `impersonatedBy` records the real admin for audit + the UI's "viewing as" banner.
  *
  * `tenantId` (F45) constrains every read/write to the caller's tenant. Resolved from the user's `tenant_id` at
  * principal-resolution time; defaults to the seeded `default` tenant for tokens without a tenant (sandbox + rollout).
  */
final case class Principal(
    userId: UUID,
    subject: String,
    email: String,
    role: String,
    impersonatedBy: Option[UUID] = None,
    tenantId: UUID = Tenant.DefaultId
)
