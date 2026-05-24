package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Valuations.RecordReq
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F20 — valuation snapshots (Principal-only) + F04 AC5: Manager sees the asset but its
  * valuation fields are stripped server-side. */
object ValuationsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby   = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna  = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  private def newAsset(xa: Transactor[IO]): IO[UUID] =
    (for {
      cat <- AssetRepo.createCategory("Watches", None)
      a   <- AssetRepo.create("Nautilus", Some("Patek"), cat, "unique", 1, Json.obj())
    } yield a.id).transact(xa)

  test("AC5 — Principal records + sees valuations; Manager sees the asset but values are stripped") { xa =>
    for {
      id   <- newAsset(xa)
      _    <- Valuations.record(xa, toby, id, RecordReq("market", 9_800_000L, "GBP", Some("auction comp")))
      _    <- Valuations.record(xa, toby, id, RecordReq("insured", 9_500_000L, "GBP", Some("Hiscox")))
      pDet <- Assets.detail(xa, toby, id).map(_.toOption.get)
      mDet <- Assets.detail(xa, lorna, id).map(_.toOption.get)
    } yield expect(pDet.marketValueMinor.contains(9_800_000L)) and
      expect(pDet.insuredValueMinor.contains(9_500_000L)) and
      expect(mDet.marketValueMinor.isEmpty) and  // stripped server-side for Manager
      expect(mDet.insuredValueMinor.isEmpty) and
      expect(mDet.title == "Nautilus")            // but Manager still sees the asset itself
  }

  test("Manager cannot record a valuation (403) nor list valuations (403)") { xa =>
    for {
      id   <- newAsset(xa)
      rec  <- Valuations.record(xa, lorna, id, RecordReq("market", 1L, "GBP", None))
      lst  <- Valuations.list(xa, lorna, id)
    } yield expect(rec.left.exists(_._1.code == 403)) and expect(lst.left.exists(_._1.code == 403))
  }

  test("Staff cannot record a valuation (403)") { xa =>
    newAsset(xa).flatMap(id => Valuations.record(xa, marcia, id, RecordReq("market", 1L, "GBP", None)))
      .map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("Principal lists the valuation history; latest market drives the detail value") { xa =>
    for {
      id   <- newAsset(xa)
      _    <- Valuations.record(xa, toby, id, RecordReq("market", 100L, "GBP", None))
      _    <- Valuations.record(xa, toby, id, RecordReq("market", 200L, "GBP", None))
      hist <- Valuations.list(xa, toby, id).map(_.toOption.get)
      det  <- Assets.detail(xa, toby, id).map(_.toOption.get)
    } yield expect(hist.count(_.kind == "market") == 2) and expect(det.marketValueMinor.contains(200L))
  }

  test("an invalid valuation kind is rejected (400)") { xa =>
    newAsset(xa).flatMap(id => Valuations.record(xa, toby, id, RecordReq("banana", 1L, "GBP", None)))
      .map(r => expect(r.left.exists(_._1.code == 400)))
  }
}
