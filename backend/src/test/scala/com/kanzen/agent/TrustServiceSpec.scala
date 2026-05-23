package com.kanzen.agent

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F27 unit test (FreeSpec): financial categories cannot be auto-executed. */
class TrustServiceSpec extends AnyFreeSpec with Matchers {
  "TrustService" - {
    "locks financial categories" in {
      TrustService.locked("Bill / Invoice") shouldBe true
      TrustService.locked("Delivery") shouldBe false
    }
    "forces financial routing to review even when auto is requested" in {
      TrustService.effectiveRouting("Bill / Invoice", "auto") shouldBe "review"
      TrustService.effectiveRouting("Delivery", "auto") shouldBe "auto"
    }
    "never auto-executes a financial category" in {
      TrustService.canAutoExecute("Receipt", "auto") shouldBe false
      TrustService.canAutoExecute("Delivery", "auto") shouldBe true
    }
  }
}
