package com.kanzen.authz

import cats.data.NonEmptyList
import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

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

  // ── F02 v2 composition (specs/F02v2-enterprise-rbac.md) ──────────────────────────────────────────
  /** The full effective role set for a user: primary `users.role` + `user_roles` + roles from every team they're in
    * **including ancestor teams** (nesting), each expanded through its `parent_role` chain.
    */
  def effectiveRoleNames(userId: UUID, primaryRole: String): ConnectionIO[List[String]] =
    sql"""
      with recursive
      my_teams as (
        select t.id, t.parent_team_id from teams t join team_members m on m.team_id = t.id
          where m.user_id = $userId and t.deleted_at is null
        union
        select p.id, p.parent_team_id from teams p join my_teams c on p.id = c.parent_team_id
          where p.deleted_at is null
      ),
      base_roles(name) as (
        select $primaryRole
        union select role_name from user_roles where user_id = $userId
        union select role_name from team_roles where team_id in (select id from my_teams)
      ),
      all_roles(name) as (
        select name from base_roles
        union
        select r.parent_role from roles r join all_roles a on r.name = a.name where r.parent_role is not null
      )
      select distinct name from all_roles where name is not null
    """.query[String].to[List]

  /** Each role's rules, grouped per role (for `Authorizer.compose`'s max-across-roles merge). */
  def rulesForRolesGrouped(roles: List[String]): ConnectionIO[List[List[Rule]]] =
    NonEmptyList.fromList(roles) match {
      case None => List.empty[List[Rule]].pure[ConnectionIO]
      case Some(nel) =>
        (fr"select role_name, resource, field, level from permission_rules where" ++ Fragments.in(fr"role_name", nel))
          .query[(String, String, Option[String], String)]
          .to[List]
          .map(_.groupBy(_._1).values.toList.map(_.map { case (_, res, f, l) => Rule(res, f, Level.parse(l)) }))
    }

  /** Action grants from the permission sets attached to any of these roles. */
  def setGrantsForRoles(roles: List[String]): ConnectionIO[List[Grant]] =
    NonEmptyList.fromList(roles) match {
      case None => List.empty[Grant].pure[ConnectionIO]
      case Some(nel) =>
        (fr"""select g.resource, g.action, g.effect, g.scope
              from permission_set_grants g
              join role_sets rs on rs.set_id = g.set_id
              join permission_sets s on s.id = g.set_id
              where s.deleted_at is null and""" ++ Fragments.in(fr"rs.role_name", nel))
          .query[(String, String, String, String)]
          .to[List]
          .map(_.map { case (res, act, eff, sc) => Grant(res, act, eff == "allow", Scope.parse(sc)) })
    }

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
