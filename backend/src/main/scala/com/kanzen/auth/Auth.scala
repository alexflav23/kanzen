package com.kanzen.auth

import cats.effect.IO
import com.kanzen.api.ApiError
import sttp.model.StatusCode

/** The Tapir security layer: a bearer token → a validated `Principal`, or a 401.
  * Wired into every secured endpoint via `serverSecurityLogic`. */
final case class Auth(jwks: Jwks, issuer: String, audience: String) {
  def securityLogic(token: String): IO[Either[(StatusCode, ApiError), Principal]] =
    JwtVerifier.verify(token, jwks, issuer, audience).map {
      case Right(c)  => Right(Principal(c.subject, c.email, c.role))
      case Left(msg) => Left((StatusCode.Unauthorized, ApiError(401, "unauthorized", msg)))
    }
}
