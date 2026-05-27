package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Brands.RecordReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** Brand catalogue (specs/03): seeded search + ranking, category normalization, find-or-create crowd enrichment
  * (idempotent), per-account hot-cache ranking, and "shared reference data" access.
  */
object BrandsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def principal(role: String, id: UUID = UUID.randomUUID()) =
    Principal(id, s"$role-sub", s"$role@kanzen.local", role)
  private val toby = principal("principal")

  test("seeded catalogue: ranked search (marquee first); prefix filter") { xa =>
    for {
      all <- Brands.search(xa, toby, "Watches", None, Some(5)).map(_.toOption.get)
      rol <- Brands.search(xa, toby, "watches", Some("rol"), Some(5)).map(_.toOption.get)
    } yield expect(all.headOption.exists(_.name == "Rolex")) and // top seed usage_count ranks first
      expect(rol.exists(_.name == "Rolex")) and expect(rol.forall(_.name.toLowerCase.startsWith("rol")))
  }

  test("category normalization: Vehicles / cars both resolve to the vehicles catalogue") { xa =>
    for {
      v1 <- Brands.search(xa, toby, "Vehicles", Some("merc"), Some(5)).map(_.toOption.get)
      v2 <- Brands.search(xa, toby, "cars", Some("merc"), Some(5)).map(_.toOption.get)
    } yield expect(v1.exists(_.name == "Mercedes-Benz")) and expect(v2.exists(_.name == "Mercedes-Benz"))
  }

  test("record: find-or-create a community brand (idempotent on normalized); appears in search") { xa =>
    val me = principal("manager")
    val name = s"Bespoke Atelier ${UUID.randomUUID().toString.take(8)}"
    for {
      b1 <- Brands.record(xa, me, RecordReq(name, "Watches")).map(_.toOption.get)
      b2 <- Brands.record(xa, me, RecordReq(name.toUpperCase, "watches")).map(_.toOption.get) // same normalized
      found <- Brands.search(xa, me, "Watches", Some(name.take(6)), Some(10)).map(_.toOption.get)
    } yield expect(b1.status == "community") and expect(b2.id == b1.id) and expect(found.exists(_.id == b1.id))
  }

  test("hot cache: an account's most-used brand outranks more globally-popular ones for that account") { xa =>
    val me = principal("principal") // fresh owner → empty hot cache
    for {
      _ <- Brands.record(xa, me, RecordReq("Tudor", "Watches"))
      _ <- Brands.record(xa, me, RecordReq("Tudor", "Watches"))
      _ <- Brands.record(xa, me, RecordReq("Tudor", "Watches"))
      top <- Brands.search(xa, me, "Watches", None, Some(3)).map(_.toOption.get)
      // a different account still sees the global ranking (Rolex), unaffected by my hot cache
      other <- Brands.search(xa, principal("principal"), "Watches", None, Some(1)).map(_.toOption.get)
    } yield expect(top.headOption.exists(_.name == "Tudor")) and expect(other.headOption.exists(_.name == "Rolex"))
  }

  test("brands are shared reference data — even Staff can read + add (no 403)") { xa =>
    val staff = principal("staff")
    for {
      s <- Brands.search(xa, staff, "Watches", None, Some(3))
      r <- Brands.record(xa, staff, RecordReq(s"Staff add ${UUID.randomUUID().toString.take(6)}", "Watches"))
    } yield expect(s.isRight) and expect(r.isRight)
  }

  test("furniture seed (operator list + expansion) is searchable") { xa =>
    for {
      boca <- Brands.search(xa, toby, "Furniture", Some("boca"), Some(5)).map(_.toOption.get)
      eich <- Brands.search(xa, toby, "furniture", Some("eich"), Some(5)).map(_.toOption.get)
      molteni <- Brands.search(xa, toby, "Furniture", Some("molteni"), Some(5)).map(_.toOption.get)
    } yield expect(boca.exists(_.name == "Boca do Lobo")) and
      expect(eich.exists(_.name == "Eichholtz")) and expect(molteni.exists(_.name == "Molteni&C"))
  }

  test("record requires a name (400)") { xa =>
    Brands.record(xa, toby, RecordReq("   ", "Watches")).map(r => expect(r.left.exists(_._1.code == 400)))
  }
}
