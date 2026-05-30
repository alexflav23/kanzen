package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Assets.{CreateReq, CustodyReq, EditReq, HeroReq, MoveReq}
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.docs.DocumentRepo
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F04 (W1.4) — move / custody / hero photo.
  *   - AC4: location + custody changes write history (actor + timestamp); out-of-scope target → 403.
  *   - AC8: hero photo via the documents store updates `hero_document_id`.
  *   - Staff cannot move/change custody (403).
  */
object AssetMoveCustodyIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val wardianProp = UUID.fromString("20000000-0000-0000-0000-000000000001")
  private val wardianLoc = UUID.fromString("60000000-0000-0000-0000-000000000004") // Wardian · Primary Bath
  private val singaporeLoc = UUID.fromString("60000000-0000-0000-0000-000000000101") // Singapore · Living Room

  private def principal(role: String, id: UUID = UUID.randomUUID()) =
    Principal(id, s"$role-sub", s"$role@kanzen.local", role)
  private val toby = principal("principal")
  // seeded Marcia is scoped to Wardian only (users row exists); drive the Manager carve-out through her id
  private val wardianManager =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "marcia-sub", "marcia@kanzen.local", "manager")

  private def newAsset(xa: Transactor[IO]): IO[UUID] =
    AssetRepo.createCategory("MoveCat", None).transact(xa).flatMap { cat =>
      Assets
        .create(
          xa,
          toby,
          CreateReq(s"Move-${UUID.randomUUID()}", None, cat, None, "unique", 1, None, None, None, None, None, None)
        )
        .map(_.toOption.get.id)
    }

  test("AC4 — Manager moves within scope (Wardian) + writes history; out-of-scope target (Singapore) → 403") { xa =>
    for {
      id <- newAsset(xa)
      ok <- Assets.move(xa, wardianManager, id, MoveReq(Some(wardianLoc), Some("to the study")))
      oos <- Assets.move(xa, wardianManager, id, MoveReq(Some(singaporeLoc), None))
      hist <- Assets.history(xa, toby, id).map(_.toOption.get)
    } yield expect(ok.toOption.exists(_.locationId.contains(wardianLoc))) and
      expect(ok.toOption.flatMap(_.propertyName).isDefined) and // resolved location label
      expect(oos.left.exists(_._1.code == 403)) and // AC4 — Singapore out of the manager's scope
      expect(hist.location.exists(_.note.contains("to the study"))) and
      expect(hist.location.exists(_.movedBy.isDefined)) // history row written with the actor
  }

  test("custody change updates current custody + writes history; bad status → 400") { xa =>
    for {
      id <- newAsset(xa)
      moved <- Assets
        .changeCustody(xa, toby, id, CustodyReq("with_repair_shop", Some("sent to AP")))
        .map(_.toOption.get)
      hist <- Assets.history(xa, toby, id).map(_.toOption.get)
      bad <- Assets.changeCustody(xa, toby, id, CustodyReq("nonsense", None))
    } yield expect(moved.custodyStatus == "with_repair_shop") and
      expect(hist.custody.exists(_.custodyStatus == "with_repair_shop")) and
      expect(bad.left.exists(_._1.code == 400))
  }

  test("AC8 — set hero photo updates hero_document_id; unknown document → 400") { xa =>
    for {
      id <- newAsset(xa)
      doc <- DocumentRepo
        .insert(
          UUID.randomUUID(),
          toby.userId,
          "hero.png",
          "photo",
          Some("image/png"),
          Some(10L),
          "k/hero.png",
          s"sha-${UUID.randomUUID()}",
          "household",
          "manual",
          None
        )
        .transact(xa)
      set <- Assets.setHero(xa, toby, id, HeroReq(doc.id)).map(_.toOption.get)
      missing <- Assets.setHero(xa, toby, id, HeroReq(UUID.randomUUID()))
    } yield expect(set.heroDocumentId.contains(doc.id)) and expect(missing.left.exists(_._1.code == 400))
  }

  // F34 — the drift bar for the Registry domain. The realtime layer (F48) + the RAG IndexConsumer both consume these;
  // a fresh asset per run makes the aggregate_id query race-proof.
  test("F34 — asset mutations emit asset.{created,updated,moved,custody_changed,set_hero} + asset_event.logged") { xa =>
    for {
      id <- newAsset(xa)
      cat <- AssetRepo.createCategory("EditCat", None).transact(xa)
      _ <- Assets.update(xa, toby, id, EditReq("Renamed", Some("Patek"), cat, "owned")).map(_.toOption.get)
      _ <- Assets.move(xa, toby, id, MoveReq(Some(wardianLoc), Some("to the study"))).map(_.toOption.get)
      _ <- Assets.changeCustody(xa, toby, id, CustodyReq("with_repair_shop", Some("sent to AP"))).map(_.toOption.get)
      doc <- DocumentRepo
        .insert(
          UUID.randomUUID(),
          toby.userId,
          "hero.png",
          "photo",
          Some("image/png"),
          Some(10L),
          s"k/hero-${UUID.randomUUID()}.png",
          s"sha-${UUID.randomUUID()}",
          "household",
          "manual",
          None
        )
        .transact(xa)
      _ <- Assets.setHero(xa, toby, id, HeroReq(doc.id)).map(_.toOption.get)
      _ <- AssetEvents
        .log(xa, toby, id, AssetEvents.LogReq("serviced", Some(12000L), Some("GBP"), Some("annual")))
        .map(
          _.toOption.get
        )
      events <-
        sql"select event_type from event_outbox where aggregate_id = $id".query[String].to[List].transact(xa)
    } yield expect(events.contains("asset.created")) and
      expect(events.contains("asset.updated")) and
      expect(events.contains("asset.moved")) and
      expect(events.contains("asset.custody_changed")) and
      expect(events.contains("asset.set_hero")) and
      expect(events.contains("asset_event.logged"))
  }

  test("staff cannot move or change custody (403)") { xa =>
    for {
      id <- newAsset(xa)
      mv <- Assets.move(xa, principal("staff"), id, MoveReq(Some(wardianLoc), None))
      cu <- Assets.changeCustody(xa, principal("staff"), id, CustodyReq("on_loan", None))
    } yield expect(mv.left.exists(_._1.code == 403)) and expect(cu.left.exists(_._1.code == 403))
  }
}
