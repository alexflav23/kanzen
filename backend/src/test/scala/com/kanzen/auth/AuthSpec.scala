package com.kanzen.auth

import cats.effect.IO
import pdi.jwt.{JwtAlgorithm, JwtCirce, JwtClaim, JwtHeader}
import weaver.SimpleIOSuite

import java.security.KeyPairGenerator
import java.security.interfaces.RSAPublicKey
import java.time.Clock
import java.util.UUID

/** F01/Phase 0 — proves the JWKS auth core against a **local test-JWKS** (a generated
  * RSA keypair), so CI validates real RS256 verification without a live Cognito pool. */
object AuthSpec extends SimpleIOSuite {
  private implicit val clock: Clock = Clock.systemUTC()

  private val kp = {
    val g = KeyPairGenerator.getInstance("RSA"); g.initialize(2048); g.generateKeyPair()
  }
  private val kid      = "test-key-1"
  private val issuer   = "https://cognito-idp.eu-west-1.amazonaws.com/test-pool"
  private val audience = "test-client-id"
  private val jwks     = Jwks.inMemory(Map(kid -> kp.getPublic.asInstanceOf[RSAPublicKey]))

  private def sign(content: String, iss: String = issuer, aud: String = audience, theKid: String = kid): String = {
    val header = JwtHeader(Some(JwtAlgorithm.RS256), Some("JWT"), None, Some(theKid))
    val claim  = JwtClaim(content = content).about("toby-sub").by(iss).to(aud).issuedNow.expiresIn(3600)
    JwtCirce.encode(header, claim, kp.getPrivate)
  }

  test("a valid RS256 token → trusted claims") {
    val token = sign("""{"email":"toby@kanzen.local","custom:role":"principal"}""")
    JwtVerifier.verify(token, jwks, issuer, audience).map { r =>
      expect(r == Right(Claims("toby-sub", "toby@kanzen.local", "principal")))
    }
  }

  test("role defaults to staff when no role claim") {
    val token = sign("""{"email":"marcia@kanzen.local"}""")
    JwtVerifier.verify(token, jwks, issuer, audience).map { r =>
      expect(r == Right(Claims("toby-sub", "marcia@kanzen.local", "staff")))
    }
  }

  test("unknown key id → rejected") {
    val token = sign("""{"email":"x@y.z"}""", theKid = "not-in-jwks")
    JwtVerifier.verify(token, jwks, issuer, audience).map(r => expect(r.isLeft))
  }

  test("bad issuer → rejected") {
    val token = sign("""{"email":"x@y.z"}""", iss = "https://evil.example")
    JwtVerifier.verify(token, jwks, issuer, audience).map(r => expect(r.isLeft))
  }

  test("bad audience → rejected") {
    val token = sign("""{"email":"x@y.z"}""", aud = "some-other-client")
    JwtVerifier.verify(token, jwks, issuer, audience).map(r => expect(r.isLeft))
  }

  test("missing email claim → rejected") {
    val token = sign("""{"custom:role":"principal"}""")
    JwtVerifier.verify(token, jwks, issuer, audience).map(r => expect(r.isLeft))
  }

  test("garbage token → rejected, not crash") {
    JwtVerifier.verify("not.a.jwt", jwks, issuer, audience).map(r => expect(r.isLeft))
  }

  // A trivial resolver — the bad-token paths fail before resolution is reached.
  private val resolveAny: Claims => IO[Option[Principal]] =
    c => IO.pure(Some(Principal(UUID.randomUUID(), c.subject, c.email, c.role)))

  test("Auth maps a bad token to a 401 ApiError") {
    val a = Auth(jwks, issuer, audience, resolveAny)
    a.securityLogic("garbage").map { r =>
      expect(r.isLeft) && expect(r.left.exists(_._1.code == 401))
    }
  }

  test("Auth maps a valid token with no matching account to a 403") {
    val a = Auth(jwks, issuer, audience, _ => IO.pure(None))
    a.securityLogic(sign("""{"email":"ghost@kanzen.local"}""")).map { r =>
      expect(r.left.exists(_._1.code == 403)) && expect(r.left.exists(_._2.code == "no_account"))
    }
  }
}
