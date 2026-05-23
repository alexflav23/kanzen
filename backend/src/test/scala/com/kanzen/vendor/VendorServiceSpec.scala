package com.kanzen.vendor

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

/** F09 unit test (FreeSpec): insurance-currency gating. */
class VendorServiceSpec extends AnyFreeSpec with Matchers {
  val today: LocalDate = LocalDate.of(2026, 5, 23)
  "VendorService.insured" - {
    "true when insurance is valid in the future" in {
      VendorService.insured(Some(today.plusDays(30)), today) shouldBe true
    }
    "false when expired" in {
      VendorService.insured(Some(today.minusDays(1)), today) shouldBe false
    }
    "false when unknown" in {
      VendorService.insured(None, today) shouldBe false
    }
    "true on the exact expiry day" in {
      VendorService.insured(Some(today), today) shouldBe true
    }
  }
}
