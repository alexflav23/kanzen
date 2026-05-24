package com.kanzen.auth

import cats.effect.IO
import io.circe.parser
import pdi.jwt.{JwtAlgorithm, JwtCirce}

import java.util.Base64
import scala.util.{Failure, Success, Try}

/** Claims we trust after RS256 + issuer/audience/expiry validation. */
final case class Claims(subject: String, email: String, role: String, impersonatedBy: Option[String] = None)

/** Validates a Cognito RS256 JWT against the JWKS: pick the key by `kid`, verify signature + expiry (jwt-scala), then
  * check issuer/audience. Pure of HTTP/DB — the key source is injected (`Jwks`), so CI runs against a local test-JWKS.
  */
object JwtVerifier {
  private def kidOf(token: String): Option[String] =
    token
      .split('.')
      .headOption
      .flatMap(h => Try(new String(Base64.getUrlDecoder.decode(h), "UTF-8")).toOption)
      .flatMap(json => parser.parse(json).toOption)
      .flatMap(_.hcursor.get[String]("kid").toOption)

  def verify(token: String, jwks: Jwks, issuer: String, audience: String): IO[Either[String, Claims]] =
    kidOf(token) match {
      case None => IO.pure(Left("malformed token: no kid in header"))
      case Some(kid) =>
        jwks.keyFor(kid).map {
          case None => Left(s"unknown key id: $kid")
          case Some(key) =>
            JwtCirce.decode(token, key, Seq(JwtAlgorithm.RS256)) match {
              case Failure(e) => Left(s"invalid token: ${e.getMessage}")
              case Success(claim) =>
                if (issuer.nonEmpty && !claim.issuer.contains(issuer)) Left("bad issuer")
                else if (audience.nonEmpty && !claim.audience.exists(_.contains(audience))) Left("bad audience")
                else
                  parser
                    .parse(claim.content)
                    .toOption
                    .flatMap { j =>
                      val c = j.hcursor
                      c.get[String]("email").toOption.map { email =>
                        val role = c
                          .get[String]("custom:role")
                          .toOption
                          .orElse(c.get[String]("role").toOption)
                          .getOrElse("staff")
                        val impersonatedBy = c.get[String]("impersonated_by").toOption // act-as: the real admin
                        Claims(claim.subject.getOrElse(""), email, role, impersonatedBy)
                      }
                    }
                    .toRight("missing required claim: email")
            }
        }
    }
}
