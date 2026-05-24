package com.kanzen.authz

import doobie.ConnectionIO

/** F02 — the single place endpoints turn a principal's role into an `Authorizer`. Loads
  * the role's rules from `permission_rules` (default-deny). Keeping construction here
  * means every endpoint authorizes the same way (resource/field level + scope at the
  * query), and field-level response filtering (`Authorizer.filterReadable`) is applied
  * by the first resource with sensitive fields (assets/valuations, F04/F20). */
object Authz {
  def authorizer(role: String): ConnectionIO[Authorizer] =
    PermissionRepo.rulesFor(role).map(Authorizer(_))
}
