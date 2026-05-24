package com.kanzen.quality

import com.kanzen.quality.CompletenessService.Checks
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F23 unit test (FreeSpec): completeness scoring + missing checks. */
class CompletenessServiceSpec extends AnyFreeSpec with Matchers {
  "CompletenessService" - {
    "scores a fully-detailed asset at 100% with nothing missing" in {
      val c = Checks(hasPhoto = true, hasCategory = true, hasLocation = true, hasProof = true)
      CompletenessService.score(c) shouldBe 100
      CompletenessService.missing(c) shouldBe empty
    }
    "scores an empty asset at 0% and lists all checks" in {
      val c = Checks(false, false, false, false)
      CompletenessService.score(c) shouldBe 0
      CompletenessService.missing(c) should contain allOf ("photo", "category", "location", "proof")
    }
    "scores a 1-of-4-missing asset at 75%" in {
      val c = Checks(hasPhoto = true, hasCategory = true, hasLocation = true, hasProof = false)
      CompletenessService.score(c) shouldBe 75
      CompletenessService.missing(c) shouldBe List("proof")
    }
  }
}
