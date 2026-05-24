package com.kanzen.finance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F38 unit test (FreeSpec): UK income-tax estimation across the bands (pence). */
class TaxServiceSpec extends AnyFreeSpec with Matchers {
  "TaxService.estimateIncomeTaxMinor" - {
    "£50,000 sits in the basic band → £7,486" in {
      TaxService.estimateIncomeTaxMinor(5_000_000L) shouldBe 748_600L
    }
    "£60,000 spans basic + higher → £11,432" in {
      TaxService.estimateIncomeTaxMinor(6_000_000L) shouldBe 1_143_200L
    }
    "£150,000 reaches the additional rate (PA fully tapered) → £53,703" in {
      TaxService.estimateIncomeTaxMinor(15_000_000L) shouldBe 5_370_300L
    }
    "income within the personal allowance is untaxed" in {
      TaxService.estimateIncomeTaxMinor(1_000_000L) shouldBe 0L
    }
    "zero / negative income is zero tax" in {
      TaxService.estimateIncomeTaxMinor(0L) shouldBe 0L
      TaxService.estimateIncomeTaxMinor(-100L) shouldBe 0L
    }
  }

  "effectiveRatePct" - {
    "is 0 for zero income and rises with income" in {
      TaxService.effectiveRatePct(0L) shouldBe 0
      TaxService.effectiveRatePct(5_000_000L) shouldBe 14 // £7,486 / £50,000
    }
  }
}
