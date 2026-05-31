package com.kanzen.auth

import cats.effect.{IO, Ref}
import io.circe.parser

import java.math.BigInteger
import java.net.URI
import java.net.http.{HttpClient, HttpRequest, HttpResponse}
import java.security.KeyFactory
import java.security.interfaces.RSAPublicKey
import java.security.spec.RSAPublicKeySpec
import java.time.Duration
import java.util.Base64
import scala.util.Try

/** F01/F44 — parse a Cognito (RFC 7517) JWKS document into RSA public keys by `kid`. Pure + HTTP-free, so it's unit-
  * tested against a synthetic JWKS built from a generated keypair — no live pool needed. Each key is `{kid, kty:"RSA",
  * n, e}` where `n`/`e` are base64url-encoded big-endian unsigned integers (the modulus + public exponent).
  */
object JwksParser {
  private def bigIntOf(b64url: String): BigInteger =
    new BigInteger(1, Base64.getUrlDecoder.decode(b64url))

  def parse(json: String): Either[String, Map[String, RSAPublicKey]] =
    parser.parse(json).left.map(_.getMessage).flatMap { doc =>
      doc.hcursor.downField("keys").values match {
        case None => Left("jwks: no `keys` array")
        case Some(keys) =>
          val kf = KeyFactory.getInstance("RSA")
          val parsed = keys.toList.flatMap { k =>
            val c = k.hcursor
            for {
              kid <- c.get[String]("kid").toOption
              n <- c.get[String]("n").toOption
              e <- c.get[String]("e").toOption
              key <- Try(
                kf.generatePublic(new RSAPublicKeySpec(bigIntOf(n), bigIntOf(e))).asInstanceOf[RSAPublicKey]
              ).toOption
            } yield kid -> key
          }
          if (parsed.isEmpty) Left("jwks: no usable RSA keys") else Right(parsed.toMap)
      }
    }
}

/** F01/F44 — the production [[Jwks]]: fetches the Cognito pool's JWKS endpoint and caches the keys by `kid`. On a cache
  * miss it refetches once (so a rotated/new signing key is picked up without a restart), then keeps serving from cache.
  * A parse/network failure keeps the last good cache rather than locking everyone out. The fetcher is injected, so the
  * cache + rotation logic is tested with a stub and the JDK `HttpClient` is only used in [[HttpJwks.http]].
  */
final class HttpJwks private (fetchJwksJson: IO[String], cache: Ref[IO, Map[String, RSAPublicKey]]) extends Jwks {
  private def refresh: IO[Unit] =
    fetchJwksJson.attempt.flatMap {
      case Right(json) => JwksParser.parse(json).fold(_ => IO.unit, keys => cache.set(keys))
      case Left(_) => IO.unit // network blip → keep the stale cache (don't lock everyone out)
    }

  def keyFor(kid: String): IO[Option[RSAPublicKey]] =
    cache.get.flatMap { m =>
      m.get(kid) match {
        case some @ Some(_) => IO.pure(some)
        case None => refresh *> cache.get.map(_.get(kid)) // unknown kid → refetch once (key rotation)
      }
    }
}

object HttpJwks {

  /** Build with an injected fetcher (tests pass a stub returning a synthetic JWKS). */
  def apply(fetchJwksJson: IO[String]): IO[HttpJwks] =
    Ref[IO].of(Map.empty[String, RSAPublicKey]).map(new HttpJwks(fetchJwksJson, _))

  /** Production: GET the JWKS over HTTP (JDK client, no extra deps) on every refresh. */
  def http(jwksUri: String): IO[HttpJwks] = {
    val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
    val fetch = IO.blocking {
      val req = HttpRequest.newBuilder(URI.create(jwksUri)).timeout(Duration.ofSeconds(5)).GET().build()
      client.send(req, HttpResponse.BodyHandlers.ofString()).body()
    }
    apply(fetch).flatTap(_.keyFor("_warm")) // warm the cache once at boot
  }
}
