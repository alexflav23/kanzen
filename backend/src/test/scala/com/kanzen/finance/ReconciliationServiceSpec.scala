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

  "ReconciliationService.scoreMatch (auto-suggest)" - {
    "exact amount + merchant + currency scores highest and is suggestable" in {
      val (score, reasons) = ReconciliationService.scoreMatch(184000L, Some("Hudson Sandler"), "GBP", 184000L, Some("Hudson Sandler"), "GBP")
      score shouldBe 100
      reasons should contain("amount matches exactly")
      reasons should contain("merchant matches")
      (score >= ReconciliationService.suggestThreshold) shouldBe true
    }
    "near amount (within 2%) on its own is below the suggest threshold" in {
      val (score, _) = ReconciliationService.scoreMatch(10000L, None, "GBP", 10100L, None, "USD")
      score shouldBe 35
      (score >= ReconciliationService.suggestThreshold) shouldBe false
    }
    "amount sign is ignored (a debit matches a positive receipt total)" in {
      val (score, _) = ReconciliationService.scoreMatch(-4250L, Some("Waitrose"), "GBP", 4250L, Some("Waitrose"), "GBP")
      score shouldBe 100
    }
    "unrelated amounts + merchants score zero" in {
      val (score, _) = ReconciliationService.scoreMatch(50000L, Some("Selfridges"), "GBP", 999L, Some("Bonhams"), "USD")
      score shouldBe 0
    }
  }
}
