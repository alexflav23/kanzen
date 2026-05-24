package com.kanzen.authz

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F02 unit test (ScalaTest FreeSpec): the RBAC truth table + attribute-level filtering. */
class AuthorizerSpec extends AnyFreeSpec with Matchers {
  import Level._

  val principal = Authorizer(List(Rule("*", None, Admin)))
  val manager = Authorizer(
    List(
      Rule("asset", None, Write),
      Rule("asset", Some("market_value"), Deny),
      Rule("asset_event", None, Write),
      Rule("ledger", None, Deny)
    )
  )
  val maintenance = Authorizer(
    List(
      Rule("asset", None, Read),
      Rule("asset", Some("acquisition_cost"), Deny),
      Rule("asset", Some("market_value"), Deny),
      Rule("asset_event", None, Write)
    )
  )

  "Principal" - {
    "has admin on everything via the wildcard" in {
      principal.can(Admin, "asset") shouldBe true
      principal.canRead("asset", Some("market_value")) shouldBe true
      principal.can(Admin, "ledger") shouldBe true
    }
  }

  "Manager" - {
    "can write assets" in { manager.can(Write, "asset") shouldBe true }
    "cannot read valuations (field-level deny wins)" in {
      manager.canRead("asset", Some("market_value")) shouldBe false
    }
    "can read ordinary fields" in { manager.canRead("asset", Some("title")) shouldBe true }
    "has no ledger access" in { manager.canRead("ledger") shouldBe false }
    "default-denies unknown resources" in { manager.canRead("backup") shouldBe false }
  }

  "Maintenance role services an item without seeing its price" in {
    maintenance.can(Write, "asset_event") shouldBe true
    maintenance.canRead("asset") shouldBe true
    maintenance.canRead("asset", Some("acquisition_cost")) shouldBe false
    val asset = Map("title" -> "Royal Oak", "acquisition_cost" -> "35000", "serial" -> "ABC123")
    maintenance.filterReadable("asset", asset).keySet shouldBe Set("title", "serial")
  }
}
