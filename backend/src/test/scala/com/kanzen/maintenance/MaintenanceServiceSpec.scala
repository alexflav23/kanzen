package com.kanzen.maintenance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

/** F11 unit test (FreeSpec): schedule roll-forward + due-soon window. */
class MaintenanceServiceSpec extends AnyFreeSpec with Matchers {
  val d: LocalDate = LocalDate.of(2026, 5, 23)
  "rollNextDue" - {
    "quarterly adds 3 months" in { MaintenanceService.rollNextDue(d, "quarterly") shouldBe d.plusMonths(3) }
    "annually adds a year" in { MaintenanceService.rollNextDue(d, "annually") shouldBe d.plusYears(1) }
    "unknown defaults to monthly" in { MaintenanceService.rollNextDue(d, "weird") shouldBe d.plusMonths(1) }
  }
  "dueSoon" - {
    "true within the lead window" in { MaintenanceService.dueSoon(d.plusDays(3), d, 5) shouldBe true }
    "false beyond it" in { MaintenanceService.dueSoon(d.plusDays(30), d, 5) shouldBe false }
  }
}
