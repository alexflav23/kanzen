package com.kanzen.finance

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F16 unit test (FreeSpec): only manual payments are markable. */
class PaymentServiceSpec extends AnyFreeSpec with Matchers {
  "PayQueueService.canMarkPaid" - {
    "manual is markable" in { PayQueueService.canMarkPaid("manual") shouldBe true }
    "auto is not (settles externally)" in { PayQueueService.canMarkPaid("auto") shouldBe false }
    "review is not" in { PayQueueService.canMarkPaid("review") shouldBe false }
  }
}
