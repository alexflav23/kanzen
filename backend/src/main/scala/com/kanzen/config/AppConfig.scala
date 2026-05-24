package com.kanzen.config

import cats.data.ValidatedNel
import cats.syntax.all._
import com.typesafe.config.{Config, ConfigFactory}

final case class DbConfig(url: String, user: String, password: String)
/** Cognito JWT validation (F01). Defaulted so the app boots without a pool — until a
  * real dev pool is configured, the JWKS is empty and `/api/me` 401s; tests inject a
  * local test-JWKS. See the plan's auth decision + ADR. */
final case class CognitoConfig(issuer: String, audience: String, jwksUri: String)
final case class AppConfig(env: String, port: Int, adminPort: Int, metricsPort: Int, db: DbConfig, cognito: CognitoConfig)

/** F00 config — typesafe-config + ValidatedNel accumulation (Hypervolt athena pattern):
  * report **all** missing keys at once, then fail fast.
  */
object AppConfig {
  private type V[A] = ValidatedNel[String, A]

  def load(cfg: Config = ConfigFactory.load()): Either[List[String], AppConfig] = {
    def str(path: String): V[String] =
      if (cfg.hasPath(path)) cfg.getString(path).validNel else s"missing config: $path".invalidNel
    def int(path: String): V[Int] =
      if (cfg.hasPath(path)) cfg.getInt(path).validNel else s"missing config: $path".invalidNel
    def strOr(path: String, default: String): String =
      if (cfg.hasPath(path)) cfg.getString(path) else default

    (
      str("kanzen.env"),
      int("kanzen.port"),
      int("kanzen.admin-port"),
      int("kanzen.metrics-port"),
      str("kanzen.db.url"),
      str("kanzen.db.user"),
      str("kanzen.db.password"),
    ).mapN { (env, port, admin, metrics, url, user, pass) =>
      val cognito = CognitoConfig(
        issuer = strOr("kanzen.cognito.issuer", ""),
        audience = strOr("kanzen.cognito.audience", ""),
        jwksUri = strOr("kanzen.cognito.jwks-uri", ""),
      )
      AppConfig(env, port, admin, metrics, DbConfig(url, user, pass), cognito)
    }.toEither.leftMap(_.toList)
  }
}
