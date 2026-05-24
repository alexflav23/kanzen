package com.kanzen.auth

/** The authenticated caller. Phase 0: derived from validated JWT claims. F01 will
  * extend it with the resolved Kanzen `userId` + property/entity scopes (F02). */
final case class Principal(subject: String, email: String, role: String)
