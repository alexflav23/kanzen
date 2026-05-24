package com.kanzen.auth

import java.util.UUID

/** The authenticated caller, resolved to a canonical Kanzen user (F01). `userId` is the `users.id` (owns rows, scopes
  * authz); `role` is the DB role (authoritative — the JWT claim is only a hint). `subject` is the Cognito sub, kept for
  * audit. `impersonatedBy` is set when an admin is acting-as this user (the impersonation engine) — the *effective*
  * principal is this user; `impersonatedBy` records the real admin for audit + the UI's "viewing as" banner.
  */
final case class Principal(userId: UUID, subject: String, email: String, role: String, impersonatedBy: Option[UUID] = None)
