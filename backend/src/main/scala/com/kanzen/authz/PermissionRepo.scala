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

  // --- role CRUD (fully DB-driven; nothing hardcoded — defaults are seeded, not baked into code) ---

  /** Create a custom (non-system) role. No-op if the name already exists. */
  def createRole(name: String, description: Option[String]): ConnectionIO[Int] =
    sql"insert into roles (name, description, is_system) values ($name, $description, false) on conflict (name) do nothing".update.run

  /** `is_system` for a role, or None if it doesn't exist. */
  def isSystemRole(name: String): ConnectionIO[Option[Boolean]] =
    sql"select is_system from roles where name = $name".query[Boolean].option

  /** Live users currently assigned this role — deleting a role they hold would lock them out. */
  def usersWithRole(name: String): ConnectionIO[Int] =
    sql"select count(*) from users where role = $name and deleted_at is null".query[Int].unique

  /** Delete a role and its permission rules (the FK has no cascade, so clear rules first). */
  def deleteRoleCascade(name: String): ConnectionIO[Int] =
    for {
      _ <- sql"delete from permission_rules where role_name = $name".update.run
      n <- sql"delete from roles where name = $name".update.run
    } yield n
}
