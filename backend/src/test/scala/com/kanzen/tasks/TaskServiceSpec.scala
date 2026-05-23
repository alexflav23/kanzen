package com.kanzen.tasks

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

import java.time.LocalDate

/** F06 unit test (FreeSpec): recurrence next-due. */
class TaskServiceSpec extends AnyFreeSpec with Matchers {
  val d: LocalDate = LocalDate.of(2026, 5, 23)
  "TaskService.nextDue" - {
    "weekly adds 7 days" in { TaskService.nextDue(d, "weekly") shouldBe d.plusWeeks(1) }
    "monthly adds a month" in { TaskService.nextDue(d, "monthly") shouldBe d.plusMonths(1) }
    "daily adds a day" in { TaskService.nextDue(d, "daily") shouldBe d.plusDays(1) }
  }
}
