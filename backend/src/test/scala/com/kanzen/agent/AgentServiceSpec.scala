package com.kanzen.agent

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F25 unit test (FreeSpec): classification + action mapping + financial-never-auto. */
class AgentServiceSpec extends AnyFreeSpec with Matchers {
  "AgentService.classify" - {
    "an invoice subject -> Bill / Invoice" in {
      AgentService.classify("SP Group · May invoice available") shouldBe "Bill / Invoice"
    }
    "a dispatch subject -> Delivery" in {
      AgentService.classify("Your Amazon order has been dispatched") shouldBe "Delivery"
    }
    "an unknown subject -> Other" in { AgentService.classify("hello") shouldBe "Other" }
  }
  "AgentService.proposedActions" - {
    "a delivery proposes a task + event" in {
      AgentService.proposedActions("Delivery") should contain allOf ("create_task", "create_event")
    }
  }
  "financial categories can never auto-execute (F27)" in {
    TrustService.canAutoExecute("Bill / Invoice", "auto") shouldBe false
    TrustService.canAutoExecute("Delivery", "auto") shouldBe true
  }
}
