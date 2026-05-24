package com.kanzen.replenishment

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

/** F36 unit test (FreeSpec): cadence + prediction. */
class ReplenishmentServiceSpec extends AnyFreeSpec with Matchers {
  "ReplenishmentService" - {
    "learns a weekly cadence" in {
      val weekly =
        List(LocalDate.of(2026, 5, 1), LocalDate.of(2026, 5, 8), LocalDate.of(2026, 5, 15), LocalDate.of(2026, 5, 22))
      ReplenishmentService.avgIntervalDays(weekly) shouldBe Some(7.0)
    }
    "predicts the next purchase" in {
      ReplenishmentService.predictedNext(LocalDate.of(2026, 5, 22), 7.0) shouldBe LocalDate.of(2026, 5, 29)
    }
    "needs >= 2 data points" in {
      ReplenishmentService.avgIntervalDays(List(LocalDate.of(2026, 5, 1))) shouldBe None
    }
    "flags due soon within the lead" in {
      ReplenishmentService.dueSoon(LocalDate.of(2026, 5, 24), LocalDate.of(2026, 5, 22), 3) shouldBe true
    }
  }
}
