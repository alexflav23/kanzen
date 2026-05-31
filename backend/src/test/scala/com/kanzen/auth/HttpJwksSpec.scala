package com.kanzen.auth

import cats.effect.{IO, Ref}
import pdi.jwt.{JwtAlgorithm, JwtCirce, JwtClaim, JwtHeader}
import weaver.SimpleIOSuite

import java.math.BigInteger
import java.security.interfaces.RSAPublicKey
import java.security.{KeyPair, KeyPairGenerator}
import java.time.Clock
import java.util.Base64

/** F01/F44 — the production Cognito auth path, exercised without a live pool: a synthetic JWKS built from a generated
  * keypair round-trips through [[JwksParser]] + [[JwtVerifier]] exactly as a real Cognito RS256 token would. Also pins
  * the [[HttpJwks]] cache + key-rotation behaviour. The operator only supplies the real pool's JWKS URL + issuer/aud.
  */
object HttpJwksSpec extends SimpleIOSuite {
  private implicit val clock: Clock = Clock.systemUTC()

  private val kp: KeyPair = {
    val g = KeyPairGenerator.getInstance("RSA"); g.initialize(2048); g.generateKeyPair()
  }
  private val kid = "test-kid-1"
  private val issuer = "https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_TEST"
  private val audience = "test-client-id"

  // Build a real RFC-7517 JWKS document from the public key (n,e as base64url unsigned big-endian).
  private def b64url(bi: BigInteger): String = {
    val raw = bi.toByteArray
    val unsigned = if (raw.length > 1 && raw(0) == 0) raw.tail else raw
    Base64.getUrlEncoder.withoutPadding.encodeToString(unsigned)
  }
  private val pub = kp.getPublic.asInstanceOf[RSAPublicKey]
  private val jwksJson =
    s"""{"keys":[{"kid":"$kid","kty":"RSA","alg":"RS256","use":"sig",
       |"n":"${b64url(pub.getModulus)}","e":"${b64url(pub.getPublicExponent)}"}]}""".stripMargin

  private def signToken(email: String, role: String): String = {
    val content = io.circe.Json
      .obj("email" -> io.circe.Json.fromString(email), "custom:role" -> io.circe.Json.fromString(role))
      .noSpaces
    val claim = JwtClaim(content).about(email).issuedNow.expiresIn(3600).by(issuer).to(audience)
    JwtCirce.encode(JwtHeader(Some(JwtAlgorithm.RS256), Some("JWT"), None, Some(kid)), claim, kp.getPrivate)
  }

  test("JwksParser parses a JWKS document into RSA keys by kid") {
    IO.pure(JwksParser.parse(jwksJson)).map { parsed =>
      expect(parsed.isRight) and expect(parsed.exists(_.contains(kid))) and
        expect(parsed.exists(_(kid).getModulus == pub.getModulus))
    }
  }

  test("a Cognito-style RS256 token verifies end-to-end against the fetched JWKS") {
    for {
      jwks <- HttpJwks(IO.pure(jwksJson))
      res <- JwtVerifier.verify(signToken("ada@acme.test", "manager"), jwks, issuer, audience)
    } yield expect(res.exists(_.email == "ada@acme.test")) and expect(res.exists(_.role == "manager"))
  }

  test("a token signed by a DIFFERENT key is rejected (forgery)") {
    val other = { val g = KeyPairGenerator.getInstance("RSA"); g.initialize(2048); g.generateKeyPair() }
    val forged = {
      val claim = JwtClaim("{}").about("x@x").issuedNow.expiresIn(3600).by(issuer).to(audience)
      JwtCirce.encode(JwtHeader(Some(JwtAlgorithm.RS256), Some("JWT"), None, Some(kid)), claim, other.getPrivate)
    }
    for {
      jwks <- HttpJwks(IO.pure(jwksJson))
      res <- JwtVerifier.verify(forged, jwks, issuer, audience)
    } yield expect(res.isLeft) // signature doesn't match the published key
  }

  test("the cache fetches once for a known kid; an unknown kid triggers exactly one refetch (rotation)") {
    for {
      calls <- Ref[IO].of(0)
      fetch = calls.update(_ + 1) *> IO.pure(jwksJson)
      jwks <- HttpJwks(fetch)
      _ <- jwks.keyFor(kid) // miss → fetch #1
      _ <- jwks.keyFor(kid) // served from cache → no fetch
      afterKnown <- calls.get
      missing <- jwks.keyFor("unknown-kid") // miss → refetch #2 (still absent)
      afterUnknown <- calls.get
    } yield expect(afterKnown == 1) and expect(missing.isEmpty) and expect(afterUnknown == 2)
  }
}
