package com.kanzen.property

import com.kanzen.tenant.Tenant
import cats.effect.IO
import cats.syntax.all._
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F03 integration test: property + a typed nested location tree (room → cabinet). */
object PropertyIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("create property, build a nested location tree, query it back") { xa =>
    val prog = for {
      p <- PropertyRepo.create("Wardian, Apt 5206", Some("London E14"), Some("uk"), "GBP")
      room <- PropertyRepo.addLocation(p.id, None, "room", "Living room")
      cabinet <- PropertyRepo.addLocation(p.id, Some(room.id), "cabinet", "Drinks cabinet")
      _ <- PropertyRepo.addLocation(p.id, Some(cabinet.id), "shelf", "Top shelf")
      locs <- PropertyRepo.locations(p.id)
    } yield (p, room, cabinet, locs)

    prog.transact(xa).map { case (p, room, cabinet, locs) =>
      expect(p.defaultCurrency == "GBP") and
        expect(locs.size == 3) and
        expect(locs.exists(l => l.name == "Drinks cabinet" && l.parentId.contains(room.id))) and
        expect(locs.exists(l => l.name == "Top shelf" && l.parentId.contains(cabinet.id)))
    }
  }

  test("list returns created properties") { xa =>
    (PropertyRepo.create("Singapore", None, Some("sg"), "SGD") *> PropertyRepo.list(Tenant.DefaultId))
      .transact(xa)
      .map(ps => expect(ps.exists(_.name == "Singapore") && ps.exists(_.defaultCurrency == "SGD")))
  }
}
