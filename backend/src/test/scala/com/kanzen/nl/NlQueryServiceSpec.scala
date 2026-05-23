package com.kanzen.nl

import com.kanzen.nl.NlQueryService._
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F32 unit test (FreeSpec): NL translation + read-only guard. */
class NlQueryServiceSpec extends AnyFreeSpec with Matchers {
  "isReadOnly" - {
    "allows a SELECT" in { NlQueryService.isReadOnly("select count(*) from assets") shouldBe true }
    "rejects a mutation" in { NlQueryService.isReadOnly("delete from assets") shouldBe false }
  }
  "translate" - {
    "'how many guitars do I have?' -> count assets filtered to guitar" in {
      NlQueryService.translate("How many guitars do I have?") shouldBe CountIntent("asset", Some("guitar"))
    }
    "'when did I last buy shoes?' -> last-purchase intent" in {
      NlQueryService.translate("When did I last buy shoes?") shouldBe LastPurchaseIntent("shoe")
    }
    "an unrecognised prompt is Unknown" in {
      NlQueryService.translate("tell me a joke") shouldBe Unknown("tell me a joke")
    }
  }
}
