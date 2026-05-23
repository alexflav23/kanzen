package com.kanzen.api

import cats.effect.IO
import org.http4s._
import org.http4s.implicits._
import weaver.SimpleIOSuite

/** Server test (weaver, Hypervolt/athena style): exercises the real Tapir route. */
object HealthServerSpec extends SimpleIOSuite {
  test("GET /api/health returns 200 with an ok JSON body") {
    val req = Request[IO](Method.GET, uri"/api/health")
    Health.routes.orNotFound.run(req).flatMap { resp =>
      resp.as[String].map { body =>
        expect(resp.status == Status.Ok) and
          expect(body.contains("\"status\":\"ok\"")) and
          expect(body.contains("kanzen-backend"))
      }
    }
  }
}
