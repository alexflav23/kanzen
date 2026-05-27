package com.kanzen.authz

import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F02 v2 S1 — the action catalogue + `can(action)` legacy bridge. Proves the keystone is non-breaking: `can(action)`
  * is exactly today's `can(minLevel, resource)`.
  */
class ActionsSpec extends AnyFreeSpec with Matchers {
  "the catalogue" - {
    "is non-empty with unique keys and well-formed entries" in {
      Actions.all should not be empty
      Actions.all.map(_.key).distinct.size shouldBe Actions.all.size
      all(Actions.all.map(_.resource)) should not be empty
      all(Actions.all.map(_.verb)) should not be empty
    }
    "covers the core registry actions" in {
      List(
        "asset:view",
        "asset:create",
        "asset:edit",
        "asset:delete",
        "asset:move",
        "asset:value",
        "document:upload",
        "document:delete",
        "list:approve",
        "bill:approve",
        "brand:add",
        "role:manage"
      )
        .foreach(k => Actions.byKey.keySet should contain(k))
    }
  }

  "can(action) bridges to the legacy resource/level model" - {
    "a resource:write role can do every write-level action on it, but not admin-level ones" in {
      val writer = Authorizer(List(Rule("asset", scala.None, Level.Write)))
      writer.can(Actions.byKey("asset:create")) shouldBe true
      writer.can(Actions.byKey("asset:edit")) shouldBe true
      writer.can(Actions.byKey("asset:delete")) shouldBe true
      writer.can(Actions.byKey("asset:move")) shouldBe true
      writer.can(Actions.byKey("asset:value")) shouldBe false // minLevel admin
    }
    "a read-only role can view but not mutate" in {
      val reader = Authorizer(List(Rule("asset", scala.None, Level.Read)))
      reader.can(Actions.byKey("asset:view")) shouldBe true
      reader.can(Actions.byKey("asset:create")) shouldBe false
    }
    "no rule ⇒ default-deny" in {
      Authorizer(Nil).can(Actions.byKey("asset:view")) shouldBe false
    }
    "the principal's wildcard-admin grant authorizes every catalogue action" in {
      val root = Authorizer(List(Rule("*", scala.None, Level.Admin)))
      Actions.all.foreach(a => withClue(a.key)(root.can(a) shouldBe true))
    }
  }
}
