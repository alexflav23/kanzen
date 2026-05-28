package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Defects.{PatchReq, RaiseReq}
import com.kanzen.api.Locations.CreateReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import com.kanzen.property.DefectRepo
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F03 AC5/AC6 — defects: Staff may raise but not transition; Manager runs the lifecycle. */
object DefectsIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")
  private def manager = Principal(UUID.randomUUID(), "m", "lorna@kanzen.local", "manager")
  private def marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "marcia", "marcia@kanzen.local", "staff")

  test("AC5 — staff may raise a defect, but not transition it nor edit a location") { xa =>
    for {
      raised <- Defects.raise(xa, marcia, RaiseReq(wardian, None, "Leaking tap", Some("Kitchen tap drips"), "medium"))
      d = raised.toOption.get
      transition <- Defects.transition(xa, marcia, d.id, "in_progress")
      editLoc <- Locations.create(xa, marcia, CreateReq(wardian, None, "room", "Nope", None, None, None))
    } yield expect(d.reportedBy.contains(marcia.userId)) and
      expect(d.status == "open") and
      expect(transition.left.exists(_._1.code == 403)) and // field-level deny on defect.status
      expect(editLoc.left.exists(_._1.code == 403))
  }

  test("AC6 — manager runs the lifecycle; resolved_at set on resolve, cleared on reopen") { xa =>
    val prog = for {
      raised <- Defects.raise(xa, manager, RaiseReq(wardian, None, "Cracked tile", None, "low"))
      d = raised.toOption.get
      _ <- Defects.transition(xa, manager, d.id, "in_progress")
      _ <- Defects.transition(xa, manager, d.id, "resolved")
      resolvedSet <- DefectRepo.resolvedAtSet(d.id).transact(xa)
      _ <- Defects.transition(xa, manager, d.id, "open") // reopen
      afterReopen <- DefectRepo.resolvedAtSet(d.id).transact(xa)
      listed <- Defects.list(xa, manager, wardian, Some("open"))
    } yield (d, resolvedSet, afterReopen, listed)
    prog.map { case (d, resolvedSet, afterReopen, listed) =>
      expect(resolvedSet) and expect(!afterReopen) and
        expect(listed.toOption.exists(_.exists(_.id == d.id)))
    }
  }

  test("an invalid status is rejected (400)") { xa =>
    for {
      raised <- Defects.raise(xa, manager, RaiseReq(wardian, None, "X", None, "low"))
      bad <- Defects.transition(xa, manager, raised.toOption.get.id, "banana")
    } yield expect(bad.left.exists(_._1.code == 400))
  }

  test("a scoped staff member cannot raise on an out-of-scope property (404, no leak)") { xa =>
    val siti = Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "siti", "siti@kanzen.local", "staff")
    Defects
      .raise(xa, siti, RaiseReq(wardian, None, "Sneaky", None, "low"))
      .map(r => expect(r.left.exists(_._1.code == 404)))
  }

  test("manager can edit defect particulars") { xa =>
    for {
      raised <- Defects.raise(xa, manager, RaiseReq(wardian, None, "Typo", None, "low"))
      edited <- Defects.patch(xa, manager, raised.toOption.get.id, PatchReq("Fixed title", Some("more detail"), "high"))
    } yield expect(edited.toOption.exists(v => v.title == "Fixed title" && v.severity == "high"))
  }

  // Thames Plumbing — approved for Wardian + insured (V2_29); the seeded selectable plumber.
  private val plumber = UUID.fromString("60000000-0000-0000-0000-000000000001")

  test("manager assigns an approved+insured vendor; an out-of-scope vendor is rejected (F09)") { xa =>
    for {
      raised <- Defects.raise(xa, manager, RaiseReq(wardian, None, "Tap drips", None, "low"))
      id = raised.toOption.get.id
      ok <- Defects.assign(xa, manager, id, Defects.AssignReq(Some(plumber)))
      bad <- Defects.assign(xa, manager, id, Defects.AssignReq(Some(UUID.randomUUID())))
      cleared <- Defects.assign(xa, manager, id, Defects.AssignReq(None))
    } yield expect(
      ok.toOption.exists(v => v.assignedVendorId.contains(plumber) && v.assignedVendorName.exists(_.contains("Thames")))
    ) and
      expect(bad.left.exists(_._1.code == 400)) and // not approved/insured for this property
      expect(cleared.toOption.exists(_.assignedVendorId.isEmpty))
  }

  test("spawning a fix-task links a task to the defect (F06)") { xa =>
    for {
      raised <- Defects.raise(xa, manager, RaiseReq(wardian, None, "Boiler noise", None, "medium"))
      id = raised.toOption.get.id
      before = raised.toOption.get.hasTask
      spawned <- Defects.spawnTask(xa, manager, id)
    } yield expect(!before) and expect(spawned.toOption.exists(_.hasTask)) // Wardian has a task project (V2_77)
  }
}
