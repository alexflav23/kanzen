package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level, PermissionRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F02 — admin role-management: read the whole permission matrix and edit it (the "very granular permission set an
  * admin can control"). The same rules the [[Authz]] enforces everywhere are stored here; editing a rule recalibrates
  * every principal's UI on their next `/api/me`. Admin only (`*`=admin), default-deny, every change audited. The
  * principal's root grant (`principal` · `*` · admin) is protected so an admin can't lock themselves out.
  */
object Roles {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class RoleDto(name: String, description: Option[String], isSystem: Boolean)
  final case class RuleDto(role: String, resource: String, field: Option[String], level: String)
  final case class SetRuleReq(role: String, resource: String, field: Option[String], level: String)
  final case class Ok(ok: Boolean)

  private val levels = Set("none", "read", "write", "admin")

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Only an admin can manage roles."))
  private def badRequest(msg: String): (StatusCode, ApiError) =
    (StatusCode.BadRequest, ApiError(400, "bad_request", msg))
  private val locked: (StatusCode, ApiError) =
    (
      StatusCode.Conflict,
      ApiError(409, "locked", "The principal's root admin grant can't be changed (lockout protection).")
    )

  /** The one rule that must never be weakened or removed, else the admin loses all access. */
  private def isRootGrant(role: String, resource: String, field: Option[String]): Boolean =
    role == "principal" && resource == "*" && field.isEmpty

  private def adminOnly[A](p: Principal)(body: => ConnectionIO[Out[A]]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(authz => if (authz.can(Level.Admin, "*")) body else (Left(forbidden): Out[A]).pure[ConnectionIO])

  def listRoles(xa: Transactor[IO], p: Principal): IO[Out[List[RoleDto]]] =
    adminOnly(p)(
      PermissionRepo.roles.map(rs => Right(rs.map(r => RoleDto(r.name, r.description, r.isSystem))): Out[List[RoleDto]])
    ).transact(xa)

  def listRules(xa: Transactor[IO], p: Principal): IO[Out[List[RuleDto]]] =
    adminOnly(p)(
      PermissionRepo.allRules.map(rs =>
        Right(rs.map(r => RuleDto(r.role, r.resource, r.field, r.level))): Out[List[RuleDto]]
      )
    ).transact(xa)

  def setRule(xa: Transactor[IO], p: Principal, req: SetRuleReq): IO[Out[RuleDto]] =
    adminOnly(p) {
      if (!levels(req.level))
        (Left(badRequest(s"level must be one of ${levels.mkString(", ")}")): Out[RuleDto]).pure[ConnectionIO]
      else if (isRootGrant(req.role, req.resource, req.field) && req.level != "admin")
        (Left(locked): Out[RuleDto]).pure[ConnectionIO]
      else
        PermissionRepo.roleExists(req.role).flatMap {
          case false => (Left(badRequest(s"no such role: ${req.role}")): Out[RuleDto]).pure[ConnectionIO]
          case true =>
            PermissionRepo.upsert(req.role, req.resource, req.field, req.level) *>
              AuditRepo
                .write(
                  "user",
                  Some(p.userId),
                  "permission.set",
                  Some("permission_rule"),
                  None,
                  Json.obj(
                    "role" -> req.role.asJson,
                    "resource" -> req.resource.asJson,
                    "field" -> req.field.asJson,
                    "level" -> req.level.asJson
                  ),
                  Some(p.userId)
                )
                .as(Right(RuleDto(req.role, req.resource, req.field, req.level)): Out[RuleDto])
        }
    }.transact(xa)

  def deleteRule(xa: Transactor[IO], p: Principal, role: String, resource: String, field: Option[String]): IO[Out[Ok]] =
    adminOnly(p) {
      if (isRootGrant(role, resource, field)) (Left(locked): Out[Ok]).pure[ConnectionIO]
      else
        PermissionRepo.delete(role, resource, field) *>
          AuditRepo
            .write(
              "user",
              Some(p.userId),
              "permission.delete",
              Some("permission_rule"),
              None,
              Json.obj("role" -> role.asJson, "resource" -> resource.asJson, "field" -> field.asJson),
              Some(p.userId)
            )
            .as(Right(Ok(true)): Out[Ok])
    }.transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])

  val rolesEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[RoleDto], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "admin" / "roles")
      .errorOut(err)
      .out(jsonBody[List[RoleDto]])
      .summary("List roles (admin only)")

  val rulesEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[RuleDto], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "admin" / "permissions")
      .errorOut(err)
      .out(jsonBody[List[RuleDto]])
      .summary("The full permission matrix (admin only)")

  val setEndpoint: Endpoint[String, SetRuleReq, (StatusCode, ApiError), RuleDto, Any] =
    sttp.tapir.endpoint.put
      .securityIn(auth.bearer[String]())
      .in("api" / "admin" / "permissions")
      .in(jsonBody[SetRuleReq])
      .errorOut(err)
      .out(jsonBody[RuleDto])
      .summary("Set a permission rule (admin only; audited; root grant protected)")

  val deleteEndpoint: Endpoint[String, (String, String, Option[String]), (StatusCode, ApiError), Ok, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "admin" / "permissions")
      .in(query[String]("role").and(query[String]("resource")).and(query[Option[String]]("field")))
      .errorOut(err)
      .out(jsonBody[Ok])
      .summary("Delete a permission rule → role falls back to default-deny (admin only; audited)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    rolesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listRoles(xa, p)),
    rulesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listRules(xa, p)),
    setEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SetRuleReq) => setRule(xa, p, r)),
    deleteEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (role: String, resource: String, field: Option[String]) =>
        deleteRule(xa, p, role, resource, field)
      })
  )

  val endpoints: List[AnyEndpoint] = List(rolesEndpoint, rulesEndpoint, setEndpoint, deleteEndpoint)
}
