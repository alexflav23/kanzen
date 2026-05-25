package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Assets.CreateReq
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F04 — assets list/detail/create: authz (AC6 staff 403), tracking modes (AC1), JSONB attributes (AC3),
  * category-descendant filter (AC2 partial).
  */
object AssetsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def principal(role: String) = Principal(UUID.randomUUID(), s"$role-sub", s"$role@kanzen.local", role)
  private def req(
      title: String,
      cat: UUID,
      mode: String,
      qty: Int,
      parent: Option[UUID] = None,
      attrs: Json = Json.obj()
  ) =
    CreateReq(title, Some("Maker"), cat, Some("watch"), mode, qty, parent, None, None, None, Some(attrs))

  test("AC6 — staff cannot read the registry (403); principal/manager can") { xa =>
    for {
      cat <- AssetRepo.createCategory("Watches", None).transact(xa)
      _ <- Assets.create(xa, principal("principal"), req("Royal Oak", cat, "unique", 1))
      staff <- Assets.list(xa, principal("staff"), None, None)
      mgr <- Assets.list(xa, principal("manager"), None, None)
      prin <- Assets.list(xa, principal("principal"), None, None)
    } yield expect(staff.left.exists(_._1.code == 403)) and
      expect(mgr.isRight) and expect(prin.toOption.exists(_.nonEmpty))
  }

  test("AC1 — create across all three tracking modes; structured child links to its parent") { xa =>
    for {
      cat <- AssetRepo.createCategory("Porcelain", None).transact(xa)
      unique <- Assets.create(xa, principal("principal"), req("Watch", cat, "unique", 1)).map(_.toOption.get)
      grouped <- Assets
        .create(xa, principal("principal"), req("Tumblers", cat, "grouped_quantity", 6))
        .map(_.toOption.get)
      set <- Assets.create(xa, principal("principal"), req("Tea service", cat, "structured_set", 1)).map(_.toOption.get)
      child <- Assets
        .create(xa, principal("principal"), req("Cup", cat, "unique", 1, parent = Some(set.id)))
        .map(_.toOption.get)
      orphan <- Assets.create(
        xa,
        principal("principal"),
        req("Bad", cat, "unique", 1, parent = Some(UUID.randomUUID()))
      )
    } yield expect(unique.quantity == 1) and
      expect(grouped.trackingMode == "grouped_quantity" && grouped.quantity == 6) and
      expect(set.trackingMode == "structured_set") and
      expect(child.parentAssetId.contains(set.id)) and
      expect(orphan.left.exists(_._1.code == 400)) // parent must exist
  }

  test("AC3 — JSONB attributes round-trip through create + detail") { xa =>
    val attrs = Json.obj("year" -> Json.fromInt(1959), "body_wood" -> Json.fromString("mahogany"))
    for {
      cat <- AssetRepo.createCategory("Guitars", None).transact(xa)
      a <- Assets
        .create(xa, principal("principal"), req("Les Paul", cat, "unique", 1, attrs = attrs))
        .map(_.toOption.get)
      d <- Assets.detail(xa, principal("principal"), a.id).map(_.toOption.get)
    } yield expect(d.attributes.hcursor.get[Int]("year").toOption.contains(1959)) and
      expect(d.attributes.hcursor.get[String]("body_wood").toOption.contains("mahogany"))
  }

  test("AC2 (partial) — filtering by a parent category includes descendants") { xa =>
    for {
      art <- AssetRepo.createCategory("Art", None).transact(xa)
      painting <- AssetRepo.createCategory("Painting", Some(art)).transact(xa)
      _ <- Assets.create(xa, principal("principal"), req("Abstract No.4", painting, "unique", 1))
      byParent <- Assets.list(xa, principal("principal"), Some(art), None).map(_.toOption.get)
      byChild <- Assets.list(xa, principal("principal"), Some(painting), None).map(_.toOption.get)
    } yield expect(byParent.exists(_.title == "Abstract No.4")) and // parent filter includes child category
      expect(byChild.exists(_.title == "Abstract No.4"))
  }

  test("the seeded registry is visible to the principal; categories list (Staff 403)") { xa =>
    for {
      assets <- Assets.list(xa, principal("principal"), None, None).map(_.toOption.get)
      cats <- Assets.categories(xa, principal("principal")).map(_.toOption.get)
      staffCat <- Assets.categories(xa, principal("staff"))
    } yield expect(assets.exists(_.title == "Royal Oak 15500ST")) and
      expect(assets.exists(a => a.title == "Cumbria Crystal Tumblers" && a.quantity == 6)) and
      expect(cats.exists(_.name == "Watches")) and expect(cats.size >= 4) and
      expect(staffCat.left.exists(_._1.code == 403))
  }

  test("the vertical filter scopes the registry — Vehicles = the 'vehicle' vertical (generic, not a bespoke module)") {
    xa =>
      for {
        vehicles <- Assets.list(xa, principal("principal"), None, None, Some("vehicle")).map(_.toOption.get)
        all <- Assets.list(xa, principal("principal"), None, None).map(_.toOption.get)
      } yield expect(vehicles.exists(_.title == "Range Rover Autobiography")) and
        expect(vehicles.forall(_.title == "Range Rover Autobiography")) and // only vehicles
        expect(!vehicles.exists(_.title == "Royal Oak 15500ST")) and expect(all.size > vehicles.size)
  }

  test("edit an asset's key facts (Manager+); bad status 400; staff 403") { xa =>
    for {
      cat <- AssetRepo.createCategory("EditCat", None).transact(xa)
      a <- Assets.create(xa, principal("principal"), req("Old Title", cat, "unique", 1)).map(_.toOption.get)
      edited <- Assets
        .update(xa, principal("principal"), a.id, Assets.EditReq("New Title", Some("New Maker"), cat, "sold"))
        .map(_.toOption.get)
      reread <- Assets.detail(xa, principal("principal"), a.id).map(_.toOption.get)
      badStatus <- Assets.update(xa, principal("principal"), a.id, Assets.EditReq("X", None, cat, "banana"))
      staffEdit <- Assets.update(xa, principal("staff"), a.id, Assets.EditReq("Y", None, cat, "owned"))
    } yield expect(edited.title == "New Title") and expect(edited.ownershipStatus == "sold") and
      expect(reread.title == "New Title" && reread.maker.contains("New Maker")) and
      expect(badStatus.left.exists(_._1.code == 400)) and expect(staffEdit.left.exists(_._1.code == 403))
  }

  test("create is rejected for a bad tracking mode (400) and missing category (400)") { xa =>
    for {
      cat <- AssetRepo.createCategory("Misc", None).transact(xa)
      badMode <- Assets.create(xa, principal("principal"), req("X", cat, "banana", 1))
      badCat <- Assets.create(xa, principal("principal"), req("Y", UUID.randomUUID(), "unique", 1))
    } yield expect(badMode.left.exists(_._1.code == 400)) and expect(badCat.left.exists(_._1.code == 400))
  }
}
