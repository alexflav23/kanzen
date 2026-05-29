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
    "'how much did I spend on maintenance?' -> spend intent (maintenance, 12mo)" in {
      NlQueryService.translate("How much did I spend on maintenance?") shouldBe SpendIntent(Some("maintenance"), 12)
    }
    "'what's due this week?' -> due-soon intent (7 days)" in {
      NlQueryService.translate("What's due this week?") shouldBe DueSoonIntent(7)
    }
    "'where is my royal oak?' -> where-is intent" in {
      NlQueryService.translate("Where is my Royal Oak?") shouldBe WhereIsIntent("royal oak")
    }
    "'how much are my watches worth?' -> category-value (watches, not the whole portfolio)" in {
      NlQueryService.translate("How much are my watches worth?") shouldBe CategoryValueIntent("watch")
    }
    "'what's my registry worth?' (no category named) -> value-by-category breakdown" in {
      NlQueryService.translate("What's my registry worth?") shouldBe ValueByCategoryIntent()
    }
    "an unrecognised prompt is Unknown" in {
      NlQueryService.translate("tell me a joke") shouldBe Unknown("tell me a joke")
    }
  }
}
