package com.kanzen.fx

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F37 unit test (FreeSpec): conversion rounding. */
class FxServiceSpec extends AnyFreeSpec with Matchers {
  "FxService.convertMinor" - {
    "converts £1,840 -> $2,300 at 1.25" in { FxService.convertMinor(184000L, 1.25) shouldBe 230000L }
    "rounds to the nearest minor unit" in { FxService.convertMinor(100000L, 1.27185) shouldBe 127185L }
  }
}
