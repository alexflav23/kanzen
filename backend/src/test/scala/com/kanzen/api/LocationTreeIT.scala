package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Locations.{CreateReq, MoveReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F03 AC2 — the typed nested location tree + integrity (same-property parent, no cycle). */
object LocationTreeIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val wardian   = UUID.fromString("20000000-0000-0000-0000-000000000001")
  private val singapore = UUID.fromString("20000000-0000-0000-0000-000000000002")
  private def manager   = Principal(UUID.randomUUID(), "m-sub", "lorna@kanzen.local", "manager")
  private def staff     = Principal(UUID.randomUUID(), "s-sub", "marcia@kanzen.local", "staff")
  private def req(prop: UUID, parent: Option[UUID], kind: String, name: String) =
    CreateReq(prop, parent, kind, name, None, None, None)

  test("build a nested tree; a parent must be in the same property") { xa =>
    for {
      living <- Locations.create(xa, manager, req(wardian, None, "room", "Living room")).map(_.toOption.get)
      cab    <- Locations.create(xa, manager, req(wardian, Some(living.id), "cabinet", "Drinks cabinet")).map(_.toOption.get)
      cross  <- Locations.create(xa, manager, req(singapore, Some(living.id), "shelf", "Bad")) // parent in another property
      tree   <- Locations.tree(xa, manager, wardian).map(_.toOption.get)
    } yield expect(cab.parentId.contains(living.id)) and
      expect(cross.left.exists(_._1.code == 400)) and
      expect(tree.exists(_.name == "Drinks cabinet"))
  }

  test("staff cannot create locations (403, default-deny)") { xa =>
    Locations.create(xa, staff, req(wardian, None, "room", "Nope")).map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("move reparents; moving a node under its own descendant is rejected (no cycle)") { xa =>
    for {
      a     <- Locations.create(xa, manager, req(wardian, None, "room", "A")).map(_.toOption.get)
      b     <- Locations.create(xa, manager, req(wardian, Some(a.id), "area", "B")).map(_.toOption.get)
      cycle <- Locations.move(xa, manager, a.id, MoveReq(Some(b.id)))   // A under its child B
      moved <- Locations.move(xa, manager, b.id, MoveReq(None)).map(_.toOption.get) // B to top level
    } yield expect(cycle.left.exists(_._1.code == 400)) and expect(moved.parentId.isEmpty)
  }

  test("a scoped user gets 404 for another property's tree (no leak)") { xa =>
    val siti = Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "siti", "siti@kanzen.local", "staff")
    Locations.tree(xa, siti, wardian).map(r => expect(r.left.exists(_._1.code == 404)))
  }
}
