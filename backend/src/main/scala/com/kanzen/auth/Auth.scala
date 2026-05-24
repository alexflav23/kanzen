package com.kanzen.auth

import cats.effect.IO
import com.kanzen.api.ApiError
import sttp.model.StatusCode

/** The Tapir security layer: a bearer token → a validated, DB-resolved `Principal`. Verify the JWT
  * (signature/issuer/audience/expiry), then resolve the claims to an active Kanzen user (`resolve`). 401 if the token
  * is bad; 403 if it's valid but maps to no active account. Wired into every secured endpoint via
  * `serverSecurityLogic`.
  */
final case class Auth(jwks: Jwks, issuer: String, audience: String, resolve: Claims => IO[Option[Principal]]) {
  def securityLogic(token: String): IO[Either[(StatusCode, ApiError), Principal]] =
    JwtVerifier.verify(token, jwks, issuer, audience).flatMap {
      case Left(msg) => IO.pure(Left((StatusCode.Unauthorized, ApiError(401, "unauthorized", msg))))
      case Right(c) =>
        resolve(c).map {
          case Some(p) => Right(p)
          case None =>
            Left((StatusCode.Forbidden, ApiError(403, "no_account", "No active Kanzen account for this identity.")))
        }
    }
}
