package com.kanzen.authz

import doobie._
import doobie.implicits._

/** F02 — load a role's permission rules from the DB to build an Authorizer. */
object PermissionRepo {
  def rulesFor(roleName: String): ConnectionIO[List[Rule]] =
    sql"select resource, field, level from permission_rules where role_name = $roleName"
      .query[(String, Option[String], String)]
      .to[List]
      .map(_.map { case (r, f, l) => Rule(r, f, Level.parse(l)) })
}
