package com.kanzen.asset

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.syntax._
import weaver.IOSuite

/** F22 integration test: persist a template, load its schema, validate attributes. */
object TemplateIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("a stored guitar template validates conforming + non-conforming attributes") { xa =>
    val schema = Json.arr(
      Json.obj("key" -> "maker".asJson, "type" -> "string".asJson, "required" -> true.asJson),
      Json.obj("key" -> "year".asJson, "type" -> "number".asJson, "required" -> false.asJson)
    )
    val prog = for {
      _ <- TemplateRepo.create("guitar", Some("Guitar"), schema)
      loaded <- TemplateRepo.schemaFor("guitar")
    } yield loaded

    prog.transact(xa).map { loaded =>
      val fields = loaded.map(TemplateService.parseSchema).getOrElse(Nil)
      val ok = TemplateService.validate(Json.obj("maker" -> "Gibson".asJson, "year" -> 1959.asJson), fields)
      val bad = TemplateService.validate(Json.obj("year" -> 1959.asJson), fields)
      expect(fields.size == 2) and expect(ok.isEmpty) and expect(bad.exists(_.contains("maker")))
    }
  }
}
