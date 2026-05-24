package com.kanzen.auth

import java.util.UUID

/** The authenticated caller, resolved to a canonical Kanzen user (F01). `userId` is the
  * `users.id` (owns rows, scopes authz); `role` is the DB role (authoritative — the JWT
  * claim is only a hint). `subject` is the Cognito sub, kept for audit. */
final case class Principal(userId: UUID, subject: String, email: String, role: String)
