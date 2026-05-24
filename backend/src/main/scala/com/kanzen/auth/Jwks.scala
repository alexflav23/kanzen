package com.kanzen.auth

import cats.effect.IO

import java.security.interfaces.RSAPublicKey

/** Source of RSA public keys by `kid`, for verifying Cognito RS256 JWTs. */
trait Jwks {
  def keyFor(kid: String): IO[Option[RSAPublicKey]]
}

object Jwks {

  /** In-memory keyset. Used by tests (the local **test-JWKS**) and as the empty default until a real Cognito pool's
    * JWKS endpoint is wired (the HTTP-fetching impl lands with the dev pool — plan Phase 0/1, ⛔ items).
    */
  def inMemory(keys: Map[String, RSAPublicKey]): Jwks =
    (kid: String) => IO.pure(keys.get(kid))

  val empty: Jwks = inMemory(Map.empty)
}
