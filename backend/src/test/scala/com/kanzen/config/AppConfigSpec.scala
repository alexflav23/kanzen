package com.kanzen.config

import com.typesafe.config.ConfigFactory
import org.scalatest.funsuite.AnyFunSuite

/** Guards `reference.conf` — it's loaded only at app boot (Main), never by the ITs, so a HOCON error or a missing
  * env-var fallback would otherwise surface only on a real deploy. This validates it parses + carries the keys the
  * NixOS deploy wires from SSM/Secrets (incl. the F01 cognito block + its `${?ENV}` fallbacks).
  */
class AppConfigSpec extends AnyFunSuite {
  private val cfg = ConfigFactory.load()

  test("reference.conf parses and exposes every key AppConfig reads") {
    for (
      p <- List(
        "kanzen.env",
        "kanzen.public-base-url",
        "kanzen.blob-secret",
        "kanzen.cognito.issuer",
        "kanzen.cognito.audience",
        "kanzen.cognito.jwks-uri",
        "kanzen.s3.bucket",
        "kanzen.s3.region",
        "kanzen.s3.endpoint",
        "kanzen.db.url",
        "kanzen.db.user",
        "kanzen.db.password"
      )
    ) assert(cfg.hasPath(p), s"missing config key: $p")
  }

  test("cognito defaults are empty (dev-JWKS fallback) until the env wires the real pool") {
    assert(cfg.getString("kanzen.cognito.issuer") == "")
    assert(cfg.getString("kanzen.cognito.jwks-uri") == "")
  }

  test("AppConfig.load yields a valid config from the defaults") {
    assert(AppConfig.load(cfg).isRight)
  }

  test("a configured cognito jwks-uri flows through AppConfig (→ HttpJwks selection in Main)") {
    // mirrors what the deploy injects via env/SSM (kanzen.cognito.jwks-uri = ${?COGNITO_JWKS_URI})
    val overlaid = ConfigFactory
      .parseString(
        """kanzen.cognito { issuer = "https://pool", audience = "client", jwks-uri = "https://pool/jwks.json" }"""
      )
      .withFallback(cfg)
    val loaded = AppConfig.load(overlaid)
    assert(loaded.exists(_.cognito.jwksUri == "https://pool/jwks.json"))
    assert(loaded.exists(_.cognito.issuer == "https://pool"))
  }
}
