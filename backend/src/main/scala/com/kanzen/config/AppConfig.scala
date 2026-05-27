package com.kanzen.config

import cats.data.ValidatedNel
import cats.syntax.all._
import com.typesafe.config.{Config, ConfigFactory}

final case class DbConfig(url: String, user: String, password: String)

/** Cognito JWT validation (F01). Defaulted so the app boots without a pool — until a real dev pool is configured, the
  * JWKS is empty and `/api/me` 401s; tests inject a local test-JWKS. See the plan's auth decision + ADR.
  */
final case class CognitoConfig(issuer: String, audience: String, jwksUri: String)

/** F05 object store. `endpoint` empty ⇒ real AWS S3; set (e.g. http://localstack:4566) ⇒ LocalStack/custom. */
final case class S3Config(bucket: String, endpoint: String, region: String, accessKey: String, secretKey: String)

final case class AppConfig(
    env: String,
    port: Int,
    adminPort: Int,
    metricsPort: Int,
    /** The base URL the browser uses to reach this API — used to build signed blob/download URLs. */
    publicBaseUrl: String,
    /** HMAC secret for signed /api/blobs capability URLs. Stable across restarts so issued URLs stay valid. */
    blobSecret: String,
    db: DbConfig,
    cognito: CognitoConfig,
    s3: S3Config
)

/** F00 config — typesafe-config + ValidatedNel accumulation (Hypervolt athena pattern): report **all** missing keys at
  * once, then fail fast.
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
      str("kanzen.db.password")
    ).mapN { (env, port, admin, metrics, url, user, pass) =>
      val cognito = CognitoConfig(
        issuer = strOr("kanzen.cognito.issuer", ""),
        audience = strOr("kanzen.cognito.audience", ""),
        jwksUri = strOr("kanzen.cognito.jwks-uri", "")
      )
      val publicBaseUrl = strOr("kanzen.public-base-url", s"http://localhost:$port")
      val blobSecret = strOr("kanzen.blob-secret", "kanzen-dev-blob-secret")
      val s3 = S3Config(
        bucket = strOr("kanzen.s3.bucket", "kanzen-documents"),
        endpoint = strOr("kanzen.s3.endpoint", ""),
        region = strOr("kanzen.s3.region", "us-east-1"),
        accessKey = strOr("kanzen.s3.access-key", "test"),
        secretKey = strOr("kanzen.s3.secret-key", "test")
      )
      AppConfig(env, port, admin, metrics, publicBaseUrl, blobSecret, DbConfig(url, user, pass), cognito, s3)
    }.toEither
      .leftMap(_.toList)
  }
}
