package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Locations.CreateReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F03 AC3 — delete guards: a location with live children can't be deleted; an empty leaf soft-deletes. */
object LocationDeleteIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")
  private def manager = Principal(UUID.randomUUID(), "m-sub", "lorna@kanzen.local", "manager")
  private def req(parent: Option[UUID], kind: String, name: String) =
    CreateReq(wardian, parent, kind, name, None, None, None)

  test("deleting a location with children is blocked; an empty leaf soft-deletes") { xa =>
    for {
      parent  <- Locations.create(xa, manager, req(None, "room", "Study")).map(_.toOption.get)
      child   <- Locations.create(xa, manager, req(Some(parent.id), "shelf", "Shelf")).map(_.toOption.get)
      blocked <- Locations.delete(xa, manager, parent.id)
      okLeaf  <- Locations.delete(xa, manager, child.id)
      tree    <- Locations.tree(xa, manager, wardian).map(_.toOption.get)
    } yield expect(blocked.left.exists(_._1.code == 400)) and
      expect(okLeaf.isRight) and
      expect(!tree.exists(_.id == child.id)) and
      expect(tree.exists(_.id == parent.id))
  }
}
