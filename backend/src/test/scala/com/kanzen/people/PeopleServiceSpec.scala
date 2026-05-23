package com.kanzen.people

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

/** F10 unit test (FreeSpec): expiry-window logic. */
class PeopleServiceSpec extends AnyFreeSpec with Matchers {
  val today: LocalDate = LocalDate.of(2026, 5, 23)
  "PeopleService.expiresWithin" - {
    "flags Siti's permit due in 50 days within a 60-day window" in {
      PeopleService.expiresWithin(Some(today.plusDays(50)), today, 60) shouldBe true
    }
    "does not flag a permit 200 days out" in {
      PeopleService.expiresWithin(Some(today.plusDays(200)), today, 60) shouldBe false
    }
    "does not flag an already-expired permit" in {
      PeopleService.expiresWithin(Some(today.minusDays(1)), today, 60) shouldBe false
    }
    "does not flag a missing permit" in {
      PeopleService.expiresWithin(None, today, 60) shouldBe false
    }
  }
}
