package com.kanzen.finance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F14 unit test (FreeSpec): transfer detection. */
class ReconciliationServiceSpec extends AnyFreeSpec with Matchers {
  "ReconciliationService.isTransferPair" - {
    "equal-and-opposite amounts are a transfer" in {
      ReconciliationService.isTransferPair(-100000L, 100000L) shouldBe true
      ReconciliationService.isTransferPair(100000L, -100000L) shouldBe true
    }
    "same-sign amounts are not a transfer" in {
      ReconciliationService.isTransferPair(-100000L, -100000L) shouldBe false
    }
    "zero is not a transfer" in {
      ReconciliationService.isTransferPair(0L, 0L) shouldBe false
    }
  }
}
