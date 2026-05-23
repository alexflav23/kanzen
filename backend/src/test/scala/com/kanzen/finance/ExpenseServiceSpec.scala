package com.kanzen.finance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F17 unit test (FreeSpec): per-jurisdiction approval-threshold routing. */
class ExpenseServiceSpec extends AnyFreeSpec with Matchers {
  "ExpenseService.needsApproval" - {
    "routes a £1,840 expense for approval (>= £1,500)" in {
      ExpenseService.needsApproval(184000L, "GBP") shouldBe true
    }
    "auto-approves a £100 expense" in {
      ExpenseService.needsApproval(10000L, "GBP") shouldBe false
    }
    "routes S$2,640 for approval (>= S$2,500)" in {
      ExpenseService.needsApproval(264000L, "SGD") shouldBe true
    }
    "auto-approves S$100" in {
      ExpenseService.needsApproval(10000L, "SGD") shouldBe false
    }
    "requires approval for an unknown currency (safe default)" in {
      ExpenseService.needsApproval(100L, "CHF") shouldBe true
    }
  }

  "initialStatus" - {
    "is pending_approval above threshold, approved below" in {
      ExpenseService.initialStatus(184000L, "GBP") shouldBe "pending_approval"
      ExpenseService.initialStatus(10000L, "GBP") shouldBe "approved"
    }
  }
}
