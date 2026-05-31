package com.kanzen.mail

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.util.UUID

/** F46 — the email-verification magic-link capability token round-trip. */
class VerifyTokenSpec extends AnyFreeSpec with Matchers {
  private val secret = "verify-secret-123"
  private val tenant = UUID.randomUUID()
  private val user = UUID.randomUUID()
  private val now = 1_800_000_000L

  "VerifyToken" - {
    "round-trips (tenant, user) for a valid, unexpired token" in {
      val tok = VerifyToken.mint(tenant, user, secret, now)
      VerifyToken.parse(tok, secret, now) shouldBe Some((tenant, user))
    }
    "rejects a forged secret" in {
      VerifyToken.parse(VerifyToken.mint(tenant, user, secret, now), "other", now) shouldBe None
    }
    "expires after 7 days" in {
      VerifyToken.parse(VerifyToken.mint(tenant, user, secret, now), secret, now + 8L * 24 * 3600) shouldBe None
    }
    "rejects a token of a different capability kind (a feed token is not a verify token)" in {
      val feed = com.kanzen.calendar.CalendarFeed.tokenFor(tenant, user, secret, now)
      VerifyToken.parse(feed, secret, now) shouldBe None
    }
  }
}
