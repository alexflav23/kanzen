package com.kanzen

import com.kanzen.api.Health
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.should.Matchers

/** Unit test in ScalaTest **FreeSpec** style (as requested). */
class HealthUnitSpec extends AnyFreeSpec with Matchers {
  "Health.status" - {
    "reports ok" in {
      Health.status.status shouldBe "ok"
    }
    "names the service and version" in {
      Health.status.service shouldBe "kanzen-backend"
      Health.status.version shouldBe "0.1.0"
    }
  }
}
