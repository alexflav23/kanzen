package com.kanzen.authz

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F02 v2 (S4) — the management/write side of enterprise RBAC: CRUD for permission sets + grants, role composition
  * (sets + parent inheritance), nested teams (members / roles / property scopes) and multi-role users. The read/
  * compose side lives in [[PermissionRepo]]; this is what the builder UI drives. All callers gate on root-admin + audit
  * in the API layer.
  */
object RbacAdminRepo {

  // ── permission sets ──────────────────────────────────────────────────────────────────────────
  final case class SetRow(id: UUID, name: String, description: Option[String], isSystem: Boolean, grantCount: Int)
  final case class GrantRow(resource: String, action: String, field: String, scope: String, effect: String)

  def listSets: ConnectionIO[List[SetRow]] =
    sql"""select s.id, s.name, s.description, s.is_system, count(g.set_id)
          from permission_sets s left join permission_set_grants g on g.set_id = s.id
          where s.deleted_at is null
          group by s.id, s.name, s.description, s.is_system
          order by s.is_system desc, s.name"""
      .query[(UUID, String, Option[String], Boolean, Int)]
      .to[List]
      .map(_.map { case (i, n, d, sys, c) => SetRow(i, n, d, sys, c) })

  def setExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from permission_sets where id = $id and deleted_at is null)".query[Boolean].unique

  def setNameTaken(name: String): ConnectionIO[Boolean] =
    sql"select exists(select 1 from permission_sets where name = $name and deleted_at is null)".query[Boolean].unique

  def isSystemSet(id: UUID): ConnectionIO[Option[Boolean]] =
    sql"select is_system from permission_sets where id = $id and deleted_at is null".query[Boolean].option

  def createSet(name: String, description: Option[String]): ConnectionIO[UUID] =
    sql"insert into permission_sets (name, description) values ($name, $description) returning id".query[UUID].unique

  def updateSet(id: UUID, name: String, description: Option[String]): ConnectionIO[Int] =
    sql"update permission_sets set name = $name, description = $description where id = $id and deleted_at is null".update.run

  def softDeleteSet(id: UUID): ConnectionIO[Int] =
    sql"update permission_sets set deleted_at = now() where id = $id and deleted_at is null".update.run

  def grantsForSet(id: UUID): ConnectionIO[List[GrantRow]] =
    sql"""select resource, action, field, scope, effect from permission_set_grants where set_id = $id
          order by resource, action, field"""
      .query[(String, String, String, String, String)]
      .to[List]
      .map(_.map { case (r, a, f, sc, e) => GrantRow(r, a, f, sc, e) })

  /** Idempotent upsert of one grant (composite PK on set_id+resource+action+field). */
  def upsertGrant(
      setId: UUID,
      resource: String,
      action: String,
      field: String,
      scope: String,
      effect: String
  ): ConnectionIO[Int] =
    sql"""insert into permission_set_grants (set_id, resource, action, field, scope, effect)
          values ($setId, $resource, $action, $field, $scope, $effect)
          on conflict (set_id, resource, action, field)
          do update set scope = excluded.scope, effect = excluded.effect""".update.run

  def deleteGrant(setId: UUID, resource: String, action: String, field: String): ConnectionIO[Int] =
    sql"""delete from permission_set_grants
          where set_id = $setId and resource = $resource and action = $action and field = $field""".update.run

  // ── role composition (sets + inheritance) ─────────────────────────────────────────────────────
  def setsForRole(role: String): ConnectionIO[List[UUID]] =
    sql"""select rs.set_id from role_sets rs join permission_sets s on s.id = rs.set_id
          where rs.role_name = $role and s.deleted_at is null""".query[UUID].to[List]

  def attachSet(role: String, setId: UUID): ConnectionIO[Int] =
    sql"insert into role_sets (role_name, set_id) values ($role, $setId) on conflict do nothing".update.run

  def detachSet(role: String, setId: UUID): ConnectionIO[Int] =
    sql"delete from role_sets where role_name = $role and set_id = $setId".update.run

  def parentOf(role: String): ConnectionIO[Option[String]] =
    sql"select parent_role from roles where name = $role".query[Option[String]].option.map(_.flatten)

  def setParentRole(role: String, parent: Option[String]): ConnectionIO[Int] =
    sql"update roles set parent_role = $parent where name = $role".update.run

  /** Would setting `role.parent = parent` create a cycle? (walk parent's ancestry looking for `role`). */
  def wouldCycle(role: String, parent: String): ConnectionIO[Boolean] =
    sql"""with recursive chain(name) as (
            select $parent
            union
            select r.parent_role from roles r join chain c on r.name = c.name where r.parent_role is not null
          )
          select exists(select 1 from chain where name = $role)""".query[Boolean].unique

  // ── teams (nested) ────────────────────────────────────────────────────────────────────────────
  final case class TeamRow(
      id: UUID,
      name: String,
      parentTeamId: Option[UUID],
      description: Option[String],
      memberCount: Int,
      roleCount: Int
  )

  def listTeams: ConnectionIO[List[TeamRow]] =
    sql"""select t.id, t.name, t.parent_team_id, t.description,
                 (select count(*) from team_members m where m.team_id = t.id),
                 (select count(*) from team_roles r where r.team_id = t.id)
          from teams t where t.deleted_at is null order by t.name"""
      .query[(UUID, String, Option[UUID], Option[String], Int, Int)]
      .to[List]
      .map(_.map { case (i, n, p, d, mc, rc) => TeamRow(i, n, p, d, mc, rc) })

  def teamExists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from teams where id = $id and deleted_at is null)".query[Boolean].unique

  def createTeam(name: String, parentTeamId: Option[UUID], description: Option[String]): ConnectionIO[UUID] =
    sql"insert into teams (name, parent_team_id, description) values ($name, $parentTeamId, $description) returning id"
      .query[UUID]
      .unique

  def updateTeam(id: UUID, name: String, parentTeamId: Option[UUID], description: Option[String]): ConnectionIO[Int] =
    sql"""update teams set name = $name, parent_team_id = $parentTeamId, description = $description
          where id = $id and deleted_at is null""".update.run

  def softDeleteTeam(id: UUID): ConnectionIO[Int] =
    sql"update teams set deleted_at = now() where id = $id and deleted_at is null".update.run

  /** Cycle guard for team nesting (walk parent's ancestry for `team`). */
  def teamWouldCycle(team: UUID, parent: UUID): ConnectionIO[Boolean] =
    sql"""with recursive chain(id) as (
            select $parent::uuid
            union
            select t.parent_team_id from teams t join chain c on t.id = c.id where t.parent_team_id is not null
          )
          select exists(select 1 from chain where id = $team)""".query[Boolean].unique

  def teamMembers(id: UUID): ConnectionIO[List[UUID]] =
    sql"select user_id from team_members where team_id = $id".query[UUID].to[List]
  def addMember(teamId: UUID, userId: UUID): ConnectionIO[Int] =
    sql"insert into team_members (team_id, user_id) values ($teamId, $userId) on conflict do nothing".update.run
  def removeMember(teamId: UUID, userId: UUID): ConnectionIO[Int] =
    sql"delete from team_members where team_id = $teamId and user_id = $userId".update.run

  def teamRoles(id: UUID): ConnectionIO[List[String]] =
    sql"select role_name from team_roles where team_id = $id order by role_name".query[String].to[List]
  def addTeamRole(teamId: UUID, role: String): ConnectionIO[Int] =
    sql"insert into team_roles (team_id, role_name) values ($teamId, $role) on conflict do nothing".update.run
  def removeTeamRole(teamId: UUID, role: String): ConnectionIO[Int] =
    sql"delete from team_roles where team_id = $teamId and role_name = $role".update.run

  def teamScopes(id: UUID): ConnectionIO[List[UUID]] =
    sql"select property_id from team_property_scopes where team_id = $id".query[UUID].to[List]
  def addTeamScope(teamId: UUID, propertyId: UUID): ConnectionIO[Int] =
    sql"insert into team_property_scopes (team_id, property_id) values ($teamId, $propertyId) on conflict do nothing".update.run
  def removeTeamScope(teamId: UUID, propertyId: UUID): ConnectionIO[Int] =
    sql"delete from team_property_scopes where team_id = $teamId and property_id = $propertyId".update.run

  // ── multi-role users ──────────────────────────────────────────────────────────────────────────
  def rolesForUser(userId: UUID): ConnectionIO[List[String]] =
    sql"select role_name from user_roles where user_id = $userId order by role_name".query[String].to[List]
  def addUserRole(userId: UUID, role: String): ConnectionIO[Int] =
    sql"insert into user_roles (user_id, role_name) values ($userId, $role) on conflict do nothing".update.run
  def removeUserRole(userId: UUID, role: String): ConnectionIO[Int] =
    sql"delete from user_roles where user_id = $userId and role_name = $role".update.run

  /** The primary `users.role` for a user (for the effective-permissions preview), if they have a users row. */
  def primaryRoleOf(userId: UUID): ConnectionIO[Option[String]] =
    sql"select role from users where id = $userId and deleted_at is null".query[String].option

  // ── users (assignment + preview targets) ──────────────────────────────────────────────────────
  final case class UserRow(id: UUID, displayName: String, email: String, role: String)

  def listUsers: ConnectionIO[List[UserRow]] =
    sql"select id, display_name, email, role from users where deleted_at is null order by display_name"
      .query[(UUID, String, String, String)]
      .to[List]
      .map(_.map { case (i, n, e, r) => UserRow(i, n, e, r) })
}
