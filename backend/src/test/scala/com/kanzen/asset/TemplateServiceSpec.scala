package com.kanzen.asset

import io.circe.Json
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** F22 unit test (FreeSpec): attribute validation against a typed template. */
class TemplateServiceSpec extends AnyFreeSpec with Matchers {
  val guitar = List(FieldDef("maker", "string", required = true), FieldDef("year", "number", required = false))

  "TemplateService.validate" - {
    "passes a complete, well-typed asset" in {
      TemplateService.validate(
        Json.obj("maker" -> Json.fromString("Gibson"), "year" -> Json.fromInt(1959)),
        guitar
      ) shouldBe empty
    }
    "flags a missing required field" in {
      TemplateService.validate(Json.obj("year" -> Json.fromInt(1959)), guitar) should contain("missing required: maker")
    }
    "flags a wrong type" in {
      TemplateService
        .validate(Json.obj("maker" -> Json.fromInt(1)), guitar)
        .exists(_.contains("wrong type for maker")) shouldBe true
    }
    "allows unknown (freehand) keys" in {
      TemplateService.validate(
        Json.obj("maker" -> Json.fromString("Gibson"), "nickname" -> Json.fromString("Lucille")),
        guitar
      ) shouldBe empty
    }
  }
}
