package com.kanzen.finance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F15 unit test (FreeSpec): ±15% variance detection. */
class BillServiceSpec extends AnyFreeSpec with Matchers {
  "BillService" - {
    "flags the SP Group +59.6% jump (S$384.20 -> S$612.80)" in {
      BillService.isVariance(38420L, 61280L) shouldBe true
    }
    "does not flag a small +1.5% change" in {
      BillService.isVariance(38420L, 39000L) shouldBe false
    }
    "flags a -20% drop too (absolute)" in {
      BillService.isVariance(100000L, 80000L) shouldBe true
    }
    "computes the signed percentage" in {
      BillService.variancePct(100000L, 159600L) shouldBe (0.596 +- 0.001)
    }
    "treats a zero baseline as no variance" in {
      BillService.isVariance(0L, 50000L) shouldBe false
    }
  }
}
