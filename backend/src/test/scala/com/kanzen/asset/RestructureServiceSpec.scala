package com.kanzen.asset

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F24 unit test (FreeSpec): split cost allocation sums exactly to the original. */
class RestructureServiceSpec extends AnyFreeSpec with Matchers {
  "RestructureService.splitCost" - {
    "spreads remainder so allocations sum to the total" in {
      val parts = RestructureService.splitCost(100L, 3)
      parts shouldBe List(34L, 33L, 33L)
      parts.sum shouldBe 100L
    }
    "splits evenly when divisible" in {
      RestructureService.splitCost(60L, 6) shouldBe List.fill(6)(10L)
    }
    "always sums to the original (property-ish)" in {
      RestructureService.splitCost(99999L, 7).sum shouldBe 99999L
    }
  }
}
