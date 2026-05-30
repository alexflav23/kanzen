package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Auth
import com.kanzen.authz.{Level, PermissionRepo}
import com.kanzen.profile.ColourPalette
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
      colour: String, // F47 — palette key or hex; drives the avatar glow ring everywhere
      permissions: List[Perm],
      impersonatedBy: Option[String]
  )
  final case class ColourReq(colour: String)

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), MeResponse, Any] =
    sttp.tapir.endpoint.get
      .in("api" / "me")
      .securityIn(auth.bearer[String]())
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[MeResponse])
      .summary("The authenticated principal + its effective permission set (drives UI recalibration)")

  val colourEndpoint: Endpoint[String, ColourReq, (StatusCode, ApiError), Unit, Any] =
    sttp.tapir.endpoint.patch
      .in("api" / "me" / "colour")
      .securityIn(auth.bearer[String]())
      .in(jsonBody[ColourReq])
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[Unit])
      .summary("Update your identity colour (palette key or hex)")

  def serverEndpoint(a: Auth, xa: Transactor[IO]): ServerEndpoint[Any, IO] =
    endpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p =>
        (_: Unit) => {
          val tx = for {
            rules <- PermissionRepo.rulesFor(p.role)
            row <-
              sql"select display_name, colour from users where id = ${p.userId}".query[(String, String)].option
          } yield {
            val (nm, col) = row.getOrElse((p.email, ColourPalette.defaultFor(p.userId)))
            MeResponse(
              p.userId.toString,
              nm,
              p.email,
              p.role,
              if (col.isEmpty) ColourPalette.defaultFor(p.userId) else col,
              rules.map(r => Perm(r.resource, r.field, Level.label(r.level))),
              p.impersonatedBy.map(_.toString)
            )
          }
          tx.transact(xa).map(Right(_): Either[(StatusCode, ApiError), MeResponse])
        }
      )

  /** F47 — PATCH your own colour. Server validates the format; the AA-contrast check (custom hex) lives on the web. */
  def colourServerEndpoint(a: Auth, xa: Transactor[IO]): ServerEndpoint[Any, IO] =
    colourEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic { p => (r: ColourReq) =>
        val v = r.colour.trim
        if (!ColourPalette.isValid(v))
          IO.pure(
            Left(
              (
                StatusCode.UnprocessableEntity,
                ApiError(422, "bad_colour", "Colour must be a palette key or a hex like #A45B6E.")
              )
            )
          )
        else
          sql"update users set colour = $v where id = ${p.userId}".update.run
            .transact(xa)
            .as(Right(()): Either[(StatusCode, ApiError), Unit])
      }
}
