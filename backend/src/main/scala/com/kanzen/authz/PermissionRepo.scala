package com.kanzen.authz

import doobie._
import doobie.implicits._

/** F02 — load a role's permission rules from the DB to build an Authorizer, and (admin only) read/edit the whole
  * permission matrix. `field` is nullable and the unique key `(role_name, resource, field)` is NULLS-DISTINCT, so a
  * resource-level rule (field IS NULL) can't be upserted via ON CONFLICT — match it with `is not distinct from`.
  */
object PermissionRepo {
  final case class RoleRow(name: String, description: Option[String], isSystem: Boolean)
  final case class RuleRow(role: String, resource: String, field: Option[String], level: String)

  def rulesFor(roleName: String): ConnectionIO[List[Rule]] =
    sql"select resource, field, level from permission_rules where role_name = $roleName"
      .query[(String, Option[String], String)]
      .to[List]
      .map(_.map { case (r, f, l) => Rule(r, f, Level.parse(l)) })

  def roles: ConnectionIO[List[RoleRow]] =
    sql"select name, description, is_system from roles order by is_system desc, name"
      .query[(String, Option[String], Boolean)]
      .to[List]
      .map(_.map { case (n, d, s) => RoleRow(n, d, s) })

  def allRules: ConnectionIO[List[RuleRow]] =
    sql"select role_name, resource, field, level from permission_rules order by role_name, resource, field nulls first"
      .query[(String, String, Option[String], String)]
      .to[List]
      .map(_.map { case (r, res, f, l) => RuleRow(r, res, f, l) })

  def roleExists(role: String): ConnectionIO[Boolean] =
    sql"select exists (select 1 from roles where name = $role)".query[Boolean].unique

  /** Idempotent upsert of a single rule (delete-then-insert handles the NULL-distinct `field`). */
  def upsert(role: String, resource: String, field: Option[String], level: String): ConnectionIO[Int] =
    for {
      _ <-
        sql"delete from permission_rules where role_name = $role and resource = $resource and field is not distinct from $field".update.run
      n <-
        sql"insert into permission_rules (role_name, resource, field, level) values ($role, $resource, $field, $level)".update.run
    } yield n

  def delete(role: String, resource: String, field: Option[String]): ConnectionIO[Int] =
    sql"delete from permission_rules where role_name = $role and resource = $resource and field is not distinct from $field".update.run
}
