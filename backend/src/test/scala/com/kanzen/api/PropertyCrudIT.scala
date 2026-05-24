package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Defects.RaiseReq
import com.kanzen.api.Locations.CreateReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F03 — property create/patch/archive (AC8: archived = hidden from lists + read-only). */
object PropertyCrudIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def manager = Principal(UUID.randomUUID(), "m", "lorna@kanzen.local", "manager")
  private def marcia  = Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "marcia", "marcia@kanzen.local", "staff")

  test("manager creates a property; staff cannot (403)") { xa =>
    for {
      created <- Properties.create(xa, manager, Properties.CreateReq("Cotswolds Cottage", Some("Glos"), Some("GB"), Some("house"), Some("owned"), "GBP"))
      denied  <- Properties.create(xa, marcia, Properties.CreateReq("Nope", None, None, None, None, "GBP"))
      listed  <- Properties.list(xa, manager)
    } yield expect(created.toOption.exists(_.name == "Cotswolds Cottage")) and
      expect(denied.left.exists(_._1.code == 403)) and
      expect(listed.toOption.exists(_.exists(_.name == "Cotswolds Cottage")))
  }

  test("patch updates particulars") { xa =>
    for {
      created <- Properties.create(xa, manager, Properties.CreateReq("Tmp", None, None, None, None, "GBP")).map(_.toOption.get)
      patched <- Properties.patch(xa, manager, created.id, Properties.PatchReq("Renamed Villa", Some("Nice"), Some("FR"), Some("house"), Some("owned")))
    } yield expect(patched.toOption.exists(_.name == "Renamed Villa"))
  }

  test("AC8 — archived property is hidden from the list but still readable; writes blocked (409)") { xa =>
    for {
      created  <- Properties.create(xa, manager, Properties.CreateReq("To Archive", None, Some("GB"), Some("apartment"), Some("owned"), "GBP")).map(_.toOption.get)
      _        <- Properties.archive(xa, manager, created.id)
      listed   <- Properties.list(xa, manager).map(_.toOption.get)
      detail   <- Properties.detail(xa, manager, created.id)
      addLoc   <- Locations.create(xa, manager, CreateReq(created.id, None, "room", "Late room", None, None, None))
      addDefect <- Defects.raise(xa, manager, RaiseReq(created.id, None, "Late defect", None, "low"))
      patchArch <- Properties.patch(xa, manager, created.id, Properties.PatchReq("Nope", None, None, None, None))
    } yield expect(!listed.exists(_.id == created.id)) and          // hidden from list
      expect(detail.toOption.exists(_.status == "archived")) and    // still readable
      expect(addLoc.left.exists(_._1.code == 409)) and              // new activity blocked
      expect(addDefect.left.exists(_._1.code == 409)) and
      expect(patchArch.left.exists(_._1.code == 409))
  }
}
