package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Auth
import com.kanzen.authz.{Level, PermissionRepo}
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** Phase 0 / F01-F02 — `GET /api/me`: the authenticated principal **and its effective permission set**, so the web
  * recalibrates the whole UI to whoever is signed in (nav, actions and fields shown only where the principal has access
  * — default-deny, no "show-everything-then-403"). `impersonatedBy` is set when an admin is acting-as this user (the
  * impersonation engine).
  */
object Me {
  final case class Perm(resource: String, field: Option[String], level: String)
  final case class MeResponse(
      userId: String,
      name: String,
      email: String,
      role: String,
      permissions: List[Perm],
      impersonatedBy: Option[String]
  )

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), MeResponse, Any] =
    sttp.tapir.endpoint.get
      .in("api" / "me")
      .securityIn(auth.bearer[String]())
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[MeResponse])
      .summary("The authenticated principal + its effective permission set (drives UI recalibration)")

  def serverEndpoint(a: Auth, xa: Transactor[IO]): ServerEndpoint[Any, IO] =
    endpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p =>
        (_: Unit) => {
          val tx = for {
            rules <- PermissionRepo.rulesFor(p.role)
            // display name so the web can greet whoever is effectively signed in (incl. the impersonated user)
            name <- sql"select display_name from users where id = ${p.userId}".query[String].option
          } yield MeResponse(
            p.userId.toString,
            name.getOrElse(p.email),
            p.email,
            p.role,
            rules.map(r => Perm(r.resource, r.field, Level.label(r.level))),
            p.impersonatedBy.map(_.toString)
          )
          tx.transact(xa).map(Right(_): Either[(StatusCode, ApiError), MeResponse])
        }
      )
}
