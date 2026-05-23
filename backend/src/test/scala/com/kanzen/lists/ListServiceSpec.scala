package com.kanzen.lists

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F08 unit test (FreeSpec): propose/approve routing. */
class ListServiceSpec extends AnyFreeSpec with Matchers {
  "ListService.initialStatus" - {
    "staff-proposed non-recurring item needs approval" in {
      ListService.initialStatus(recurring = false, proposedByStaff = true) shouldBe "needs_approval"
    }
    "recurring staple goes straight in" in {
      ListService.initialStatus(recurring = true, proposedByStaff = true) shouldBe "added"
    }
    "manager/principal additions go straight in" in {
      ListService.initialStatus(recurring = false, proposedByStaff = false) shouldBe "added"
    }
  }
}
