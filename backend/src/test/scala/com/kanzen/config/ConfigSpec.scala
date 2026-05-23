package com.kanzen.config

import com.typesafe.config.ConfigFactory
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** FreeSpec unit test for config loading (defaults + missing-key accumulation). */
class ConfigSpec extends AnyFreeSpec with Matchers {
  "AppConfig.load" - {
    "loads defaults from reference.conf" in {
      AppConfig.load() match {
        case Right(c) =>
          c.env shouldBe "local"
          c.port shouldBe 8080
          c.adminPort shouldBe 9990
          c.metricsPort shouldBe 9464
        case Left(errs) => fail(s"unexpected errors: $errs")
      }
    }

    "accumulates ALL missing keys (not just the first)" in {
      val empty = ConfigFactory.parseString("kanzen{}")
      AppConfig.load(empty) match {
        case Left(errs) =>
          errs.size should be >= 5
          errs.exists(_.contains("kanzen.port")) shouldBe true
          errs.exists(_.contains("kanzen.db.url")) shouldBe true
        case Right(c) => fail(s"expected errors, got $c")
      }
    }
  }
}
