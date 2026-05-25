package com.kanzen.auth

import cats.effect.IO
import pdi.jwt.{JwtAlgorithm, JwtCirce, JwtClaim, JwtHeader}

import java.security.interfaces.RSAPublicKey
import java.security.{KeyPair, KeyPairGenerator}
import java.time.Clock

/** DEV-ONLY local auth. When `env=local` and no real Cognito pool is configured, the app generates an ephemeral RSA
  * keypair and mints its own RS256 JWTs (via `POST /api/dev/token`), verified against the matching in-memory `Jwks`.
  * Lets the web app + curl exercise the real auth/authz path without a live pool. Tokens live only for the process
  * lifetime; the HTTP-fetching Cognito JWKS replaces this once a pool exists.
  */
final class DevAuth private (kid: String, kp: KeyPair, issuer: String, audience: String) {
  private implicit val clock: Clock = Clock.systemUTC()

  val jwks: Jwks = Jwks.inMemory(Map(kid -> kp.getPublic.asInstanceOf[RSAPublicKey]))

  /** Mint a 12h dev token carrying the email + role (the claims the verifier reads). When `impersonatedBy` is set, the
    * token authenticates AS `email` but records the real admin (the impersonation engine — F02).
    */
  def mint(email: String, role: String, impersonatedBy: Option[String] = None): String = {
    val fields = List(
      "email" -> io.circe.Json.fromString(email),
      "custom:role" -> io.circe.Json.fromString(role)
    ) ++ impersonatedBy.map(a => "impersonated_by" -> io.circe.Json.fromString(a))
    val content = io.circe.Json.obj(fields: _*).noSpaces
    val base = JwtClaim(content).about(email).issuedNow.expiresIn(43200)
    val withIss = if (issuer.nonEmpty) base.by(issuer) else base
    val claim = if (audience.nonEmpty) withIss.to(audience) else withIss
    JwtCirce.encode(JwtHeader(Some(JwtAlgorithm.RS256), Some("JWT"), None, Some(kid)), claim, kp.getPrivate)
  }
}

object DevAuth {

  /** DEV-ONLY: a *stable* RSA keypair, derived deterministically from a fixed seed, so tokens survive backend restarts
    * (a random per-boot key would invalidate every browser session on each rebuild — "Invalid signature for this
    * token"). This only ever runs when `env=local` with no Cognito pool; real deployments verify against Cognito JWKS
    * and never touch this. The seed is not a secret.
    */
  def generate(issuer: String, audience: String): IO[DevAuth] =
    IO.blocking {
      val rnd = java.security.SecureRandom.getInstance("SHA1PRNG")
      rnd.setSeed("kanzen-dev-local-signing-key-v1".getBytes("UTF-8"))
      val gen = KeyPairGenerator.getInstance("RSA")
      gen.initialize(2048, rnd)
      new DevAuth("dev-local", gen.generateKeyPair(), issuer, audience)
    }
}
