package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.Instant
import java.util.UUID
import scala.util.Try

/** F19/W2 — the platform **audited action log**: a read-only view over `audit_log_entries` (who did what, when, to
  * what). Admin-grade oversight, so it's gated on the root `*`-admin grant (same as `Roles`/`Impersonate`); the table
  * is append-only (corrections are new events). Powers the Settings → Audit log view + per-entity activity feeds.
  */
object Audit {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class AuditEntryDto(
      id: UUID,
      at: String,
      actorType: String,
      actorId: Option[UUID],
      actorName: Option[String],
      action: String,
      targetType: Option[String],
      targetId: Option[UUID],
      detail: Json
  )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Only an admin can view the platform action log."))

  private def adminOnly[A](p: Principal)(body: => ConnectionIO[Out[A]]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(authz => if (authz.can(Level.Admin, "*")) body else (Left(forbidden): Out[A]).pure[ConnectionIO])

  private def dto(r: AuditRepo.AuditRow): AuditEntryDto =
    AuditEntryDto(
      r.id,
      r.at.toString,
      r.actorType,
      r.actorId,
      r.actorName,
      r.action,
      r.targetType,
      r.targetId,
      r.detail
    )

  def list(
      xa: Transactor[IO],
      p: Principal,
      limit: Option[Int],
      before: Option[String],
      actor: Option[UUID],
      action: Option[String],
      target: Option[String]
  ): IO[Out[List[AuditEntryDto]]] =
    adminOnly(p) {
      val lim = limit.getOrElse(100).max(1).min(200)
      val beforeInstant = before.flatMap(s => Try(Instant.parse(s)).toOption)
      AuditRepo
        .list(lim, beforeInstant, actor, action, target)
        .map(rows => Right(rows.map(dto)): Out[List[AuditEntryDto]])
    }.transact(xa)

  def actions(xa: Transactor[IO], p: Principal): IO[Out[List[String]]] =
    adminOnly(p)(AuditRepo.distinctActions.map(as => Right(as): Out[List[String]])).transact(xa)

  // A target's activity feed is visible to anyone who can read that entity's resource — map the audit target_type to
  // its catalogue resource; unknown types fall back to admin-only.
  private val resourceForTarget: Map[String, String] = Map(
    "asset" -> "asset",
    "asset_group" -> "asset",
    "collection" -> "asset",
    "asset_event" -> "asset",
    "document" -> "document",
    "property" -> "property",
    "location" -> "property",
    "defect" -> "defect",
    "vendor" -> "vendor",
    "person" -> "person",
    "list" -> "list",
    "task" -> "task",
    "calendar" -> "calendar",
    "maintenance" -> "maintenance",
    "bill" -> "bill",
    "expense" -> "expense",
    "receipt" -> "receipt"
  )

  /** The activity feed (audit trail) for one entity — gated on the viewer being able to read that entity's resource. */
  def activity(xa: Transactor[IO], p: Principal, targetType: String, targetId: UUID): IO[Out[List[AuditEntryDto]]] = {
    val notForbidden = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to this record's activity"))
    Authz
      .forUser(p.userId, p.role)
      .flatMap { authz =>
        val allowed = resourceForTarget.get(targetType).fold(authz.can(Level.Admin, "*"))(r => authz.canRead(r))
        if (!allowed) (Left(notForbidden): Out[List[AuditEntryDto]]).pure[ConnectionIO]
        else AuditRepo.forTarget(targetType, targetId, 50).map(rows => Right(rows.map(dto)): Out[List[AuditEntryDto]])
      }
      .transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val listEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "admin" / "audit")
    .in(query[Option[Int]]("limit"))
    .in(query[Option[String]]("before"))
    .in(query[Option[UUID]]("actor"))
    .in(query[Option[String]]("action"))
    .in(query[Option[String]]("target"))
    .errorOut(err)
    .out(jsonBody[List[AuditEntryDto]])
    .summary("Platform action log — every audited write, newest first (admin only; keyset-paginated by `before`)")

  val actionsEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "admin" / "audit" / "actions")
    .errorOut(err)
    .out(jsonBody[List[String]])
    .summary("Distinct action keys (for the audit-log filter)")

  val activityEndpoint = endpoint.get
    .securityIn(bearer)
    .in("api" / "activity" / path[String]("targetType") / path[UUID]("targetId"))
    .errorOut(err)
    .out(jsonBody[List[AuditEntryDto]])
    .summary("An entity's activity feed (its audit trail) — gated on reading that entity")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    actionsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => actions(xa, p)),
    listEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (limit, before, actor, action, target) =>
        list(xa, p, limit, before, actor, action, target)
      }),
    activityEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (targetType, targetId) => activity(xa, p, targetType, targetId) })
  )

  val endpoints: List[AnyEndpoint] = List(actionsEndpoint, listEndpoint, activityEndpoint)
}
