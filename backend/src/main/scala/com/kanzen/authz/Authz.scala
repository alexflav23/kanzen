package com.kanzen.authz

import com.kanzen.auth.Principal
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.{ConnectionIO, Fragment}

import java.util.UUID

/** F02 — the single place endpoints turn a principal into an `Authorizer`; default-deny + field-level response
  * filtering (`Authorizer.filterReadable`) apply uniformly.
  */
object Authz {

  /** F45 — the tenant predicate composed into every domain read/write. `alias` is the table alias used in the query
    * (e.g. `a` for `assets a`); pass `""` for an unaliased single-table query. Always emitted as `and <alias>.tenant_id
    * \= <id>` so it appends to an existing `where`. Inserts set `tenant_id = p.tenantId` directly (not via this).
    */
  def tenantFilter(p: Principal, alias: String = ""): Fragment =
    Fragment.const(s"and ${if (alias.isEmpty) "" else alias + "."}tenant_id =") ++ fr"${p.tenantId}"

  /** Single-role authorizer (legacy path; still used by endpoints until S3 migrates them to [[forUser]]). */
  def authorizer(role: String): ConnectionIO[Authorizer] =
    PermissionRepo.rulesFor(role).map(Authorizer(_))

  /** F02 v2 — the user's full **composed** authorizer: every effective role (primary + multi-role + team roles through
    * the hierarchy + inheritance) merged (additive, max-level) plus the action grants from their permission sets. With
    * nothing configured in the v2 tables this equals the single-role authorizer for the primary role (non-breaking).
    * See `specs/F02v2-enterprise-rbac.md`.
    */
  def forUser(userId: UUID, primaryRole: String): ConnectionIO[Authorizer] =
    for {
      roles <- PermissionRepo.effectiveRoleNames(userId, primaryRole)
      ruleSets <- PermissionRepo.rulesForRolesGrouped(roles)
      grants <- PermissionRepo.setGrantsForRoles(roles)
    } yield Authorizer.compose(ruleSets, grants)
}
