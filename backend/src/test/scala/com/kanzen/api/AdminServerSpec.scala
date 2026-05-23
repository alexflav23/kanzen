package com.kanzen.api

import cats.effect.IO
import org.http4s._
import org.http4s.implicits._
import weaver.SimpleIOSuite

/** Server test (weaver) for the admin health probe. */
object AdminServerSpec extends SimpleIOSuite {
  test("GET /health on the admin server returns 200 'ok'") {
    Admin.routes.orNotFound.run(Request[IO](Method.GET, uri"/health")).flatMap { resp =>
      resp.as[String].map { body =>
        expect(resp.status == Status.Ok) and expect(body == "ok")
      }
    }
  }
}
