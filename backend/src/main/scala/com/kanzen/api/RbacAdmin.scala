package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz, Level, PermissionRepo, RbacAdminRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F02 v2 (S4) — the enterprise RBAC builder's management API: permission sets + grants, role composition (sets +
  * parent inheritance), nested teams (members / roles / property scopes), multi-role users, and an
  * **effective-permissions preview** (runs the real `Authz.forUser` resolution). The RBAC admin surface stays gated on
  * the **root `*`-admin grant** (same as `Roles`/`Impersonate`) so authorization can't be delegated or escalated
  * through it; every write is audited.
  */
object RbacAdmin {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  // ── DTOs ──────────────────────────────────────────────────────────────────────────────────────
  final case class SetDto(id: UUID, name: String, description: Option[String], isSystem: Boolean, grantCount: Int)
  final case class GrantDto(resource: String, action: String, field: String, scope: String, effect: String)
  final case class SetReq(name: String, description: Option[String])
  final case class RoleCompositionDto(role: String, parentRole: Option[String], setIds: List[UUID])
  final case class ParentReq(parent: Option[String])
  final case class AttachSetReq(setId: UUID)
  final case class TeamDto(
      id: UUID,
      name: String,
      parentTeamId: Option[UUID],
      description: Option[String],
      memberCount: Int,
      roleCount: Int
  )
  final case class TeamDetailDto(
      id: UUID,
      name: String,
      parentTeamId: Option[UUID],
      description: Option[String],
      members: List[UUID],
      roles: List[String],
      propertyScopes: List[UUID]
  )
  final case class TeamReq(name: String, parentTeamId: Option[UUID], description: Option[String])
  final case class MemberReq(userId: UUID)
  final case class RoleNameReq(role: String)
  final case class ScopeReq(propertyId: UUID)
  final case class EffActionDto(key: String, resource: String, verb: String, scope: String, sensitive: Boolean)
  final case class EffectiveDto(
      userId: UUID,
      primaryRole: Option[String],
      effectiveRoles: List[String],
      allowed: List[EffActionDto]
  )
  final case class Ok(ok: Boolean)

  private val SCOPES = Set("all", "property", "team", "own")
  private val EFFECTS = Set("allow", "deny")

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Only an admin can manage RBAC."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private def notFound(m: String): (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", m))
  private def conflict(m: String): (StatusCode, ApiError) = (StatusCode.Conflict, ApiError(409, "conflict", m))

  private def adminOnly[A](p: Principal)(body: => ConnectionIO[Out[A]]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(authz => if (authz.can(Level.Admin, "*")) body else (Left(forbidden): Out[A]).pure[ConnectionIO])

  private def audit(p: Principal, action: String, target: String, detail: Json): ConnectionIO[Int] =
    AuditRepo.write("user", Some(p.userId), action, Some(target), None, detail, Some(p.userId))

  // ── permission sets ──────────────────────────────────────────────────────────────────────────
  def listSets(xa: Transactor[IO], p: Principal): IO[Out[List[SetDto]]] =
    adminOnly(p)(
      RbacAdminRepo.listSets.map(rs =>
        Right(rs.map(s => SetDto(s.id, s.name, s.description, s.isSystem, s.grantCount))): Out[List[SetDto]]
      )
    ).transact(xa)

  def createSet(xa: Transactor[IO], p: Principal, req: SetReq): IO[Out[SetDto]] =
    adminOnly(p) {
      val name = req.name.trim
      if (name.isEmpty) (Left(badReq("name is required")): Out[SetDto]).pure[ConnectionIO]
      else
        RbacAdminRepo.setNameTaken(name).flatMap {
          case true =>
            (Left(conflict("a permission set with that name already exists")): Out[SetDto]).pure[ConnectionIO]
          case false =>
            RbacAdminRepo.createSet(name, req.description).flatMap { id =>
              audit(p, "rbac.set.create", "permission_set", Json.obj("id" -> id.asJson, "name" -> name.asJson))
                .as(Right(SetDto(id, name, req.description, isSystem = false, 0)): Out[SetDto])
            }
        }
    }.transact(xa)

  def updateSet(xa: Transactor[IO], p: Principal, id: UUID, req: SetReq): IO[Out[Ok]] =
    adminOnly(p) {
      val name = req.name.trim
      if (name.isEmpty) (Left(badReq("name is required")): Out[Ok]).pure[ConnectionIO]
      else
        RbacAdminRepo.setExists(id).flatMap {
          case false => (Left(notFound("no such permission set")): Out[Ok]).pure[ConnectionIO]
          case true =>
            RbacAdminRepo.updateSet(id, name, req.description) *>
              audit(p, "rbac.set.update", "permission_set", Json.obj("id" -> id.asJson, "name" -> name.asJson))
                .as(Right(Ok(true)): Out[Ok])
        }
    }.transact(xa)

  def deleteSet(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.isSystemSet(id).flatMap {
        case None => (Left(notFound("no such permission set")): Out[Ok]).pure[ConnectionIO]
        case Some(true) => (Left(conflict("system permission sets can't be deleted")): Out[Ok]).pure[ConnectionIO]
        case Some(false) =>
          RbacAdminRepo.softDeleteSet(id) *>
            audit(p, "rbac.set.delete", "permission_set", Json.obj("id" -> id.asJson)).as(Right(Ok(true)): Out[Ok])
      }
    }.transact(xa)

  def grants(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[List[GrantDto]]] =
    adminOnly(p) {
      RbacAdminRepo.setExists(id).flatMap {
        case false => (Left(notFound("no such permission set")): Out[List[GrantDto]]).pure[ConnectionIO]
        case true =>
          RbacAdminRepo
            .grantsForSet(id)
            .map(gs =>
              Right(gs.map(g => GrantDto(g.resource, g.action, g.field, g.scope, g.effect))): Out[List[GrantDto]]
            )
      }
    }.transact(xa)

  /** Validate a grant against the catalogue: resource must be `*` or a real resource; action `*` or a real verb on it.
    */
  private def validGrant(resource: String, action: String): Option[String] =
    if (resource == "*") None
    else if (!Actions.resources.contains(resource)) Some(s"unknown resource: $resource")
    else if (action == "*") None
    else if (!Actions.all.exists(a => a.resource == resource && a.verb == action))
      Some(s"unknown action $resource:$action")
    else None

  def upsertGrant(xa: Transactor[IO], p: Principal, id: UUID, g: GrantDto): IO[Out[GrantDto]] =
    adminOnly(p) {
      val v = validGrant(g.resource, g.action)
      if (!SCOPES(g.scope))
        (Left(badReq(s"scope must be one of ${SCOPES.mkString(", ")}")): Out[GrantDto]).pure[ConnectionIO]
      else if (!EFFECTS(g.effect))
        (Left(badReq(s"effect must be one of ${EFFECTS.mkString(", ")}")): Out[GrantDto]).pure[ConnectionIO]
      else if (v.isDefined) (Left(badReq(v.get)): Out[GrantDto]).pure[ConnectionIO]
      else
        RbacAdminRepo.setExists(id).flatMap {
          case false => (Left(notFound("no such permission set")): Out[GrantDto]).pure[ConnectionIO]
          case true =>
            RbacAdminRepo.upsertGrant(id, g.resource, g.action, g.field, g.scope, g.effect) *>
              audit(p, "rbac.grant.set", "permission_set", Json.obj("setId" -> id.asJson, "grant" -> g.asJson))
                .as(Right(g): Out[GrantDto])
        }
    }.transact(xa)

  def deleteGrant(
      xa: Transactor[IO],
      p: Principal,
      id: UUID,
      resource: String,
      action: String,
      field: String
  ): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.deleteGrant(id, resource, action, field) *>
        audit(
          p,
          "rbac.grant.delete",
          "permission_set",
          Json.obj("setId" -> id.asJson, "resource" -> resource.asJson, "action" -> action.asJson)
        ).as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  // ── role composition ──────────────────────────────────────────────────────────────────────────
  def composition(xa: Transactor[IO], p: Principal, role: String): IO[Out[RoleCompositionDto]] =
    adminOnly(p) {
      PermissionRepo.roleExists(role).flatMap {
        case false => (Left(notFound("no such role")): Out[RoleCompositionDto]).pure[ConnectionIO]
        case true =>
          for {
            parent <- RbacAdminRepo.parentOf(role)
            sets <- RbacAdminRepo.setsForRole(role)
          } yield Right(RoleCompositionDto(role, parent, sets)): Out[RoleCompositionDto]
      }
    }.transact(xa)

  def setParent(xa: Transactor[IO], p: Principal, role: String, req: ParentReq): IO[Out[Ok]] =
    adminOnly(p) {
      PermissionRepo.roleExists(role).flatMap {
        case false => (Left(notFound("no such role")): Out[Ok]).pure[ConnectionIO]
        case true =>
          req.parent match {
            case None =>
              RbacAdminRepo.setParentRole(role, None) *>
                audit(p, "rbac.role.parent", "role", Json.obj("role" -> role.asJson, "parent" -> Json.Null))
                  .as(Right(Ok(true)): Out[Ok])
            case Some(par) if par == role =>
              (Left(badReq("a role can't be its own parent")): Out[Ok]).pure[ConnectionIO]
            case Some(par) =>
              PermissionRepo.roleExists(par).flatMap {
                case false => (Left(badReq(s"no such parent role: $par")): Out[Ok]).pure[ConnectionIO]
                case true =>
                  RbacAdminRepo.wouldCycle(role, par).flatMap {
                    case true =>
                      (Left(conflict("that parent would create an inheritance cycle")): Out[Ok]).pure[ConnectionIO]
                    case false =>
                      RbacAdminRepo.setParentRole(role, Some(par)) *>
                        audit(p, "rbac.role.parent", "role", Json.obj("role" -> role.asJson, "parent" -> par.asJson))
                          .as(Right(Ok(true)): Out[Ok])
                  }
              }
          }
      }
    }.transact(xa)

  def attachSet(xa: Transactor[IO], p: Principal, role: String, req: AttachSetReq): IO[Out[Ok]] =
    adminOnly(p) {
      for {
        roleOk <- PermissionRepo.roleExists(role)
        setOk <- RbacAdminRepo.setExists(req.setId)
        res <-
          if (!roleOk) (Left(notFound("no such role")): Out[Ok]).pure[ConnectionIO]
          else if (!setOk) (Left(badReq("no such permission set")): Out[Ok]).pure[ConnectionIO]
          else
            RbacAdminRepo.attachSet(role, req.setId) *>
              audit(p, "rbac.role.attach_set", "role", Json.obj("role" -> role.asJson, "setId" -> req.setId.asJson))
                .as(Right(Ok(true)): Out[Ok])
      } yield res
    }.transact(xa)

  def detachSet(xa: Transactor[IO], p: Principal, role: String, setId: UUID): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.detachSet(role, setId) *>
        audit(p, "rbac.role.detach_set", "role", Json.obj("role" -> role.asJson, "setId" -> setId.asJson))
          .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  // ── teams ─────────────────────────────────────────────────────────────────────────────────────
  def listTeams(xa: Transactor[IO], p: Principal): IO[Out[List[TeamDto]]] =
    adminOnly(p)(
      RbacAdminRepo.listTeams.map(ts =>
        Right(ts.map(t => TeamDto(t.id, t.name, t.parentTeamId, t.description, t.memberCount, t.roleCount))): Out[
          List[TeamDto]
        ]
      )
    ).transact(xa)

  def teamDetail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[TeamDetailDto]] =
    adminOnly(p) {
      RbacAdminRepo.teamExists(id).flatMap {
        case false => (Left(notFound("no such team")): Out[TeamDetailDto]).pure[ConnectionIO]
        case true =>
          for {
            t <- RbacAdminRepo.listTeams.map(_.find(_.id == id))
            members <- RbacAdminRepo.teamMembers(id)
            roles <- RbacAdminRepo.teamRoles(id)
            scopes <- RbacAdminRepo.teamScopes(id)
          } yield t match {
            case None => Left(notFound("no such team"))
            case Some(row) =>
              Right(TeamDetailDto(row.id, row.name, row.parentTeamId, row.description, members, roles, scopes))
          }
      }
    }.transact(xa)

  def createTeam(xa: Transactor[IO], p: Principal, req: TeamReq): IO[Out[TeamDto]] =
    adminOnly(p) {
      val name = req.name.trim
      if (name.isEmpty) (Left(badReq("name is required")): Out[TeamDto]).pure[ConnectionIO]
      else
        req.parentTeamId.fold(true.pure[ConnectionIO])(RbacAdminRepo.teamExists).flatMap { parentOk =>
          if (!parentOk) (Left(badReq("no such parent team")): Out[TeamDto]).pure[ConnectionIO]
          else
            RbacAdminRepo.createTeam(name, req.parentTeamId, req.description).flatMap { id =>
              audit(p, "rbac.team.create", "team", Json.obj("id" -> id.asJson, "name" -> name.asJson))
                .as(Right(TeamDto(id, name, req.parentTeamId, req.description, 0, 0)): Out[TeamDto])
            }
        }
    }.transact(xa)

  def updateTeam(xa: Transactor[IO], p: Principal, id: UUID, req: TeamReq): IO[Out[Ok]] =
    adminOnly(p) {
      val name = req.name.trim
      if (name.isEmpty) (Left(badReq("name is required")): Out[Ok]).pure[ConnectionIO]
      else
        RbacAdminRepo.teamExists(id).flatMap {
          case false => (Left(notFound("no such team")): Out[Ok]).pure[ConnectionIO]
          case true =>
            val cycle = req.parentTeamId match {
              case Some(par) if par == id => true.pure[ConnectionIO]
              case Some(par) => RbacAdminRepo.teamWouldCycle(id, par)
              case None => false.pure[ConnectionIO]
            }
            cycle.flatMap {
              case true => (Left(conflict("that parent would create a team cycle")): Out[Ok]).pure[ConnectionIO]
              case false =>
                RbacAdminRepo.updateTeam(id, name, req.parentTeamId, req.description) *>
                  audit(p, "rbac.team.update", "team", Json.obj("id" -> id.asJson, "name" -> name.asJson))
                    .as(Right(Ok(true)): Out[Ok])
            }
        }
    }.transact(xa)

  def deleteTeam(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.teamExists(id).flatMap {
        case false => (Left(notFound("no such team")): Out[Ok]).pure[ConnectionIO]
        case true =>
          RbacAdminRepo.softDeleteTeam(id) *>
            audit(p, "rbac.team.delete", "team", Json.obj("id" -> id.asJson)).as(Right(Ok(true)): Out[Ok])
      }
    }.transact(xa)

  def addMember(xa: Transactor[IO], p: Principal, id: UUID, req: MemberReq): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.teamExists(id).flatMap {
        case false => (Left(notFound("no such team")): Out[Ok]).pure[ConnectionIO]
        case true =>
          RbacAdminRepo.addMember(id, req.userId) *>
            audit(p, "rbac.team.add_member", "team", Json.obj("teamId" -> id.asJson, "userId" -> req.userId.asJson))
              .as(Right(Ok(true)): Out[Ok])
      }
    }.transact(xa)

  def removeMember(xa: Transactor[IO], p: Principal, id: UUID, userId: UUID): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.removeMember(id, userId) *>
        audit(p, "rbac.team.remove_member", "team", Json.obj("teamId" -> id.asJson, "userId" -> userId.asJson))
          .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  def addTeamRole(xa: Transactor[IO], p: Principal, id: UUID, req: RoleNameReq): IO[Out[Ok]] =
    adminOnly(p) {
      for {
        teamOk <- RbacAdminRepo.teamExists(id)
        roleOk <- PermissionRepo.roleExists(req.role)
        res <-
          if (!teamOk) (Left(notFound("no such team")): Out[Ok]).pure[ConnectionIO]
          else if (!roleOk) (Left(badReq("no such role")): Out[Ok]).pure[ConnectionIO]
          else
            RbacAdminRepo.addTeamRole(id, req.role) *>
              audit(p, "rbac.team.add_role", "team", Json.obj("teamId" -> id.asJson, "role" -> req.role.asJson))
                .as(Right(Ok(true)): Out[Ok])
      } yield res
    }.transact(xa)

  def removeTeamRole(xa: Transactor[IO], p: Principal, id: UUID, role: String): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.removeTeamRole(id, role) *>
        audit(p, "rbac.team.remove_role", "team", Json.obj("teamId" -> id.asJson, "role" -> role.asJson))
          .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  def addTeamScope(xa: Transactor[IO], p: Principal, id: UUID, req: ScopeReq): IO[Out[Ok]] =
    adminOnly(p) {
      for {
        teamOk <- RbacAdminRepo.teamExists(id)
        propOk <- sql"select exists(select 1 from properties where id = ${req.propertyId})".query[Boolean].unique
        res <-
          if (!teamOk) (Left(notFound("no such team")): Out[Ok]).pure[ConnectionIO]
          else if (!propOk) (Left(badReq("no such property")): Out[Ok]).pure[ConnectionIO]
          else
            RbacAdminRepo.addTeamScope(id, req.propertyId) *>
              audit(
                p,
                "rbac.team.add_scope",
                "team",
                Json.obj("teamId" -> id.asJson, "propertyId" -> req.propertyId.asJson)
              )
                .as(Right(Ok(true)): Out[Ok])
      } yield res
    }.transact(xa)

  def removeTeamScope(xa: Transactor[IO], p: Principal, id: UUID, propertyId: UUID): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.removeTeamScope(id, propertyId) *>
        audit(p, "rbac.team.remove_scope", "team", Json.obj("teamId" -> id.asJson, "propertyId" -> propertyId.asJson))
          .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  // ── multi-role users ──────────────────────────────────────────────────────────────────────────
  final case class UserDto(id: UUID, displayName: String, email: String, role: String)

  def listUsers(xa: Transactor[IO], p: Principal): IO[Out[List[UserDto]]] =
    adminOnly(p)(
      RbacAdminRepo.listUsers.map(us =>
        Right(us.map(u => UserDto(u.id, u.displayName, u.email, u.role))): Out[List[UserDto]]
      )
    ).transact(xa)

  def userRoles(xa: Transactor[IO], p: Principal, userId: UUID): IO[Out[List[String]]] =
    adminOnly(p)(RbacAdminRepo.rolesForUser(userId).map(rs => Right(rs): Out[List[String]])).transact(xa)

  def addUserRole(xa: Transactor[IO], p: Principal, userId: UUID, req: RoleNameReq): IO[Out[Ok]] =
    adminOnly(p) {
      PermissionRepo.roleExists(req.role).flatMap {
        case false => (Left(badReq("no such role")): Out[Ok]).pure[ConnectionIO]
        case true =>
          RbacAdminRepo.addUserRole(userId, req.role) *>
            audit(p, "rbac.user.add_role", "user", Json.obj("userId" -> userId.asJson, "role" -> req.role.asJson))
              .as(Right(Ok(true)): Out[Ok])
      }
    }.transact(xa)

  def removeUserRole(xa: Transactor[IO], p: Principal, userId: UUID, role: String): IO[Out[Ok]] =
    adminOnly(p) {
      RbacAdminRepo.removeUserRole(userId, role) *>
        audit(p, "rbac.user.remove_role", "user", Json.obj("userId" -> userId.asJson, "role" -> role.asJson))
          .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  // ── effective-permissions preview ──────────────────────────────────────────────────────────────
  /** Runs the *real* `Authz.forUser` resolution for a user and reports the catalogue actions they can perform (with the
    * narrowest scope), plus their effective role set — the builder's "what can this user actually do?".
    */
  def effective(xa: Transactor[IO], p: Principal, userId: UUID): IO[Out[EffectiveDto]] =
    adminOnly(p) {
      for {
        primary <- RbacAdminRepo.primaryRoleOf(userId)
        prim = primary.getOrElse("")
        authz <- Authz.forUser(userId, prim)
        roles <- PermissionRepo.effectiveRoleNames(userId, prim)
      } yield {
        val allowed = Actions.all.filter(authz.can).map { a =>
          EffActionDto(a.key, a.resource, a.verb, authz.scopeFor(a).name, a.sensitive)
        }
        Right(EffectiveDto(userId, primary, roles.filter(_.nonEmpty).sorted, allowed)): Out[EffectiveDto]
      }
    }.transact(xa)

  // ── endpoints ────────────────────────────────────────────────────────────────────────────────
  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()
  private val base = "api" / "admin" / "rbac"

  val listSetsEp = endpoint.get
    .securityIn(bearer)
    .in(base / "sets")
    .errorOut(err)
    .out(jsonBody[List[SetDto]])
    .summary("List permission sets (admin)")
  val createSetEp = endpoint.post
    .securityIn(bearer)
    .in(base / "sets")
    .in(jsonBody[SetReq])
    .errorOut(err)
    .out(jsonBody[SetDto])
    .summary("Create a permission set")
  val updateSetEp = endpoint.put
    .securityIn(bearer)
    .in(base / "sets" / path[UUID]("id"))
    .in(jsonBody[SetReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Rename/redescribe a permission set")
  val deleteSetEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "sets" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Delete a (non-system) permission set")
  val grantsEp = endpoint.get
    .securityIn(bearer)
    .in(base / "sets" / path[UUID]("id") / "grants")
    .errorOut(err)
    .out(jsonBody[List[GrantDto]])
    .summary("Grants in a permission set")
  val upsertGrantEp = endpoint.put
    .securityIn(bearer)
    .in(base / "sets" / path[UUID]("id") / "grants")
    .in(jsonBody[GrantDto])
    .errorOut(err)
    .out(jsonBody[GrantDto])
    .summary("Add/update a grant (object × action + scope + effect)")
  val deleteGrantEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "sets" / path[UUID]("id") / "grants")
    .in(query[String]("resource").and(query[String]("action")).and(query[String]("field")))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove a grant")

  val compositionEp = endpoint.get
    .securityIn(bearer)
    .in(base / "roles" / path[String]("role") / "composition")
    .errorOut(err)
    .out(jsonBody[RoleCompositionDto])
    .summary("A role's parent + attached sets")
  val parentEp = endpoint.put
    .securityIn(bearer)
    .in(base / "roles" / path[String]("role") / "parent")
    .in(jsonBody[ParentReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Set/clear a role's parent (cycle-guarded)")
  val attachSetEp = endpoint.post
    .securityIn(bearer)
    .in(base / "roles" / path[String]("role") / "sets")
    .in(jsonBody[AttachSetReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Attach a permission set to a role")
  val detachSetEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "roles" / path[String]("role") / "sets" / path[UUID]("setId"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Detach a permission set from a role")

  val listTeamsEp = endpoint.get
    .securityIn(bearer)
    .in(base / "teams")
    .errorOut(err)
    .out(jsonBody[List[TeamDto]])
    .summary("List teams")
  val teamDetailEp = endpoint.get
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[TeamDetailDto])
    .summary("A team's members, roles + property scopes")
  val createTeamEp = endpoint.post
    .securityIn(bearer)
    .in(base / "teams")
    .in(jsonBody[TeamReq])
    .errorOut(err)
    .out(jsonBody[TeamDto])
    .summary("Create a team (optionally nested)")
  val updateTeamEp = endpoint.put
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id"))
    .in(jsonBody[TeamReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Rename/reparent a team (cycle-guarded)")
  val deleteTeamEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Delete a team")
  val addMemberEp = endpoint.post
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "members")
    .in(jsonBody[MemberReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Add a member to a team")
  val removeMemberEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "members" / path[UUID]("userId"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove a member from a team")
  val addTeamRoleEp = endpoint.post
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "roles")
    .in(jsonBody[RoleNameReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Grant a role to a team")
  val removeTeamRoleEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "roles" / path[String]("role"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove a role from a team")
  val addTeamScopeEp = endpoint.post
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "scopes")
    .in(jsonBody[ScopeReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Add a property scope to a team")
  val removeTeamScopeEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "teams" / path[UUID]("id") / "scopes" / path[UUID]("propertyId"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove a property scope from a team")

  val listUsersEp = endpoint.get
    .securityIn(bearer)
    .in(base / "users")
    .errorOut(err)
    .out(jsonBody[List[UserDto]])
    .summary("List accounts (for member/assignment pickers + the effective preview)")
  val userRolesEp = endpoint.get
    .securityIn(bearer)
    .in(base / "users" / path[UUID]("userId") / "roles")
    .errorOut(err)
    .out(jsonBody[List[String]])
    .summary("A user's additional (non-primary) roles")
  val addUserRoleEp = endpoint.post
    .securityIn(bearer)
    .in(base / "users" / path[UUID]("userId") / "roles")
    .in(jsonBody[RoleNameReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Assign an additional role to a user")
  val removeUserRoleEp = endpoint.delete
    .securityIn(bearer)
    .in(base / "users" / path[UUID]("userId") / "roles" / path[String]("role"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Remove an additional role from a user")
  val effectiveEp = endpoint.get
    .securityIn(bearer)
    .in(base / "users" / path[UUID]("userId") / "effective")
    .errorOut(err)
    .out(jsonBody[EffectiveDto])
    .summary("A user's effective permissions (real Authz.forUser resolution)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listSetsEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listSets(xa, p)),
    createSetEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SetReq) => createSet(xa, p, r)),
    updateSetEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => updateSet(xa, p, id, r) }),
    deleteSetEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => deleteSet(xa, p, id)),
    grantsEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => grants(xa, p, id)),
    upsertGrantEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, g) => upsertGrant(xa, p, id, g) }),
    deleteGrantEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, res, act, fld) =>
        deleteGrant(xa, p, id, res, act, fld)
      }),
    compositionEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: String) => composition(xa, p, r)),
    parentEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (r, req) => setParent(xa, p, r, req) }),
    attachSetEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (r, req) => attachSet(xa, p, r, req) }),
    detachSetEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (r, sid) => detachSet(xa, p, r, sid) }),
    listTeamsEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listTeams(xa, p)),
    teamDetailEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => teamDetail(xa, p, id)),
    createTeamEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: TeamReq) => createTeam(xa, p, r)),
    updateTeamEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => updateTeam(xa, p, id, r) }),
    deleteTeamEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => deleteTeam(xa, p, id)),
    addMemberEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addMember(xa, p, id, r) }),
    removeMemberEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, uid) =>
        removeMember(xa, p, id, uid)
      }),
    addTeamRoleEp.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addTeamRole(xa, p, id, r) }),
    removeTeamRoleEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, role) =>
        removeTeamRole(xa, p, id, role)
      }),
    addTeamScopeEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => addTeamScope(xa, p, id, r) }),
    removeTeamScopeEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, pid) =>
        removeTeamScope(xa, p, id, pid)
      }),
    listUsersEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listUsers(xa, p)),
    userRolesEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (uid: UUID) => userRoles(xa, p, uid)),
    addUserRoleEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (uid, r) => addUserRole(xa, p, uid, r) }),
    removeUserRoleEp
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (uid, role) =>
        removeUserRole(xa, p, uid, role)
      }),
    effectiveEp.serverSecurityLogic(a.securityLogic).serverLogic(p => (uid: UUID) => effective(xa, p, uid))
  )

  val endpoints: List[AnyEndpoint] = List(
    listSetsEp,
    createSetEp,
    updateSetEp,
    deleteSetEp,
    grantsEp,
    upsertGrantEp,
    deleteGrantEp,
    compositionEp,
    parentEp,
    attachSetEp,
    detachSetEp,
    listTeamsEp,
    teamDetailEp,
    createTeamEp,
    updateTeamEp,
    deleteTeamEp,
    addMemberEp,
    removeMemberEp,
    addTeamRoleEp,
    removeTeamRoleEp,
    addTeamScopeEp,
    removeTeamScopeEp,
    listUsersEp,
    userRolesEp,
    addUserRoleEp,
    removeUserRoleEp,
    effectiveEp
  )
}
