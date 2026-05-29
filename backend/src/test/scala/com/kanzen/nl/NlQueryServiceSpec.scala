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
    "'what vehicles do I own?' -> list(vehicle)" in {
      NlQueryService.translate("What vehicles do I own?") shouldBe ListIntent(Some("vehicle"))
    }
    "'list my watches' -> list(watch)" in {
      NlQueryService.translate("list my watches") shouldBe ListIntent(Some("watch"))
    }
    "an unrecognised prompt is Unknown" in {
      NlQueryService.translate("tell me a joke") shouldBe Unknown("tell me a joke")
    }
    // NL-2b crisp intents — and that they win over the generic branches they sit near.
    "'when is my car next due a service?' -> service-due(car), NOT due-soon" in {
      NlQueryService.translate("When is my car next due a service?") shouldBe ServiceDueIntent("car")
    }
    "'how much is my car insurance for my Mercedes?' -> insurance(mercedes), NOT spend" in {
      NlQueryService.translate("How much is my car insurance for my Mercedes?") shouldBe InsuranceAmountIntent(
        "mercedes"
      )
    }
    "'how much did I spend on insurance?' stays a spend intent (premium spend, not asset cover)" in {
      NlQueryService.translate("How much did I spend on insurance?") shouldBe SpendIntent(Some("insurance"), 12)
    }
    "'when was the housekeeper last in?' -> last-activity(housekeeper)" in {
      NlQueryService.translate("When was the housekeeper last in?") shouldBe LastActivityIntent("housekeeper")
    }
  }
  "subject" - {
    "takes the noun after the last my/the marker, up to a stopword" in {
      NlQueryService.subject("when is my car next due a service") shouldBe "car"
      NlQueryService.subject("how much is my car insurance for my mercedes") shouldBe "mercedes"
      NlQueryService.subject("when was the housekeeper last in") shouldBe "housekeeper"
    }
  }
  "stem" - {
    "loosens a role-noun to match its activity title" in {
      NlQueryService.stem("housekeeper") shouldBe "housekeep" // matches "Housekeeping"
      NlQueryService.stem("gardener") shouldBe "garden"
      NlQueryService.stem("personal trainer") shouldBe "train"
    }
  }
}
