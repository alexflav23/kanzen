package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Assets.{CreateReq => AssetReq}
import com.kanzen.api.Templates.{CreateReq => TemplateReq, FieldView}
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F22 — category templates: seeded schema readable; template validation wired into asset create (required + typed keys
  * enforced; unknown keys allowed).
  */
object TemplatesApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private def cat(xa: Transactor[IO]) = AssetRepo.createCategory("Misc", None).transact(xa)
  private def asset(c: UUID, vertical: String, attrs: Json) =
    AssetReq("Item", Some("Maker"), c, Some(vertical), "unique", 1, None, None, None, None, Some(attrs))

  test("the seeded watch template is readable") { xa =>
    Templates.schema(xa, toby, "watch").map {
      case Right(fields) =>
        expect(fields.exists(_.key == "serial")) and expect(
          fields.exists(f => f.key == "case_mm" && f.fieldType == "number")
        )
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("a Principal creates a template; missing required + wrong type are rejected on asset create") { xa =>
    for {
      c <- cat(xa)
      _ <- Templates.create(
        xa,
        toby,
        TemplateReq(
          "rare_book",
          Some("Rare book"),
          List(FieldView("title_year", "number", required = true), FieldView("binding", "string", required = false))
        )
      )
      // valid: required number present, optional string ok, unknown key allowed
      ok <- Assets.create(
        xa,
        toby,
        asset(
          c,
          "rare_book",
          Json.obj(
            "title_year" -> Json.fromInt(1812),
            "binding" -> Json.fromString("leather"),
            "extra" -> Json.fromString("freehand")
          )
        )
      )
      missing <- Assets.create(
        xa,
        toby,
        asset(c, "rare_book", Json.obj("binding" -> Json.fromString("leather")))
      ) // missing required title_year
      wrong <- Assets.create(
        xa,
        toby,
        asset(c, "rare_book", Json.obj("title_year" -> Json.fromString("not a number")))
      ) // wrong type
    } yield expect(ok.isRight) and
      expect(missing.left.exists(_._1.code == 400)) and
      expect(wrong.left.exists(_._1.code == 400))
  }

  test("a vertical with no template imposes no constraints") { xa =>
    for {
      c <- cat(xa)
      ok <- Assets.create(xa, toby, asset(c, "no_such_vertical", Json.obj("anything" -> Json.fromString("goes"))))
    } yield expect(ok.isRight)
  }
}
