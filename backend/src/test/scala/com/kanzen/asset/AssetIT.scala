package com.kanzen.asset

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

/** F04 integration test: category + assets with JSONB attributes (round-trip + filter). */
object AssetIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("create a watch with JSONB attributes; round-trip and filter by category") { xa =>
    val attrs = Json.obj(
      "serial" -> Json.fromString("AP-12345"),
      "movement" -> Json.fromString("automatic"),
      "case_mm" -> Json.fromInt(41)
    )
    val prog = for {
      watches <- AssetRepo.createCategory("Watches", None)
      ro <- AssetRepo.create("Royal Oak", Some("Audemars Piguet"), watches, "unique", 1, attrs)
      fetched <- AssetRepo.get(ro.id)
      inCat <- AssetRepo.byCategory(watches)
    } yield (fetched, inCat)

    prog.transact(xa).map { case (fetched, inCat) =>
      val serial = fetched.flatMap(_.attributes.hcursor.get[String]("serial").toOption)
      expect(fetched.exists(_.title == "Royal Oak")) and
        expect(fetched.exists(_.maker.contains("Audemars Piguet"))) and
        expect(serial.contains("AP-12345")) and
        expect(inCat.size == 1)
    }
  }

  test("grouped-quantity asset stores its quantity") { xa =>
    val prog = for {
      glass <- AssetRepo.createCategory("Glassware", None)
      tumblers <- AssetRepo.create("Tumblers", Some("Riedel"), glass, "grouped_quantity", 6, Json.obj())
      fetched <- AssetRepo.get(tumblers.id)
    } yield fetched
    prog.transact(xa).map(f => expect(f.exists(a => a.trackingMode == "grouped_quantity" && a.quantity == 6)))
  }
}
