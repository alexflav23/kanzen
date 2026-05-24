package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Auth
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** Phase 0 — `GET /api/me`: the authenticated principal. Proves the Cognito JWKS auth stack end-to-end (bearer →
  * validated `Principal` → response, or 401).
  */
object Me {
  final case class MeResponse(userId: String, email: String, role: String)

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), MeResponse, Any] =
    sttp.tapir.endpoint.get
      .in("api" / "me")
      .securityIn(auth.bearer[String]())
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[MeResponse])
      .summary("The authenticated principal (proves Cognito JWKS auth)")

  def serverEndpoint(a: Auth): ServerEndpoint[Any, IO] =
    endpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p =>
        (_: Unit) =>
          IO.pure(Right(MeResponse(p.userId.toString, p.email, p.role)): Either[(StatusCode, ApiError), MeResponse])
      )
}
