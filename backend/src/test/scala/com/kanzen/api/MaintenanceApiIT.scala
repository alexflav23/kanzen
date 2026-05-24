package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Maintenance.{CompleteReq, CreateReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F11 — maintenance: due-soon flag, create, complete rolls next_due forward; authz. */
object MaintenanceApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("seeded boiler-service plan lists; Staff can read") { xa =>
    Maintenance.list(xa, marcia).map {
      case Right(plans) => expect(plans.exists(_.title.contains("Boiler service")))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("a plan due within its lead window is flagged dueSoon") { xa =>
    for {
      due <- Maintenance
        .create(xa, lorna, CreateReq("Gutter clean", None, None, "annually", LocalDate.now.plusDays(3), Some(14)))
        .map(_.toOption.get)
      far <- Maintenance
        .create(xa, lorna, CreateReq("Repaint", None, None, "annually", LocalDate.now.plusDays(200), Some(14)))
        .map(_.toOption.get)
    } yield expect(due.dueSoon) and expect(!far.dueSoon)
  }

  test("completing a service rolls next_due forward by frequency") { xa =>
    for {
      plan <- Maintenance
        .create(xa, lorna, CreateReq("Filter swap", None, None, "quarterly", LocalDate.now, Some(7)))
        .map(_.toOption.get)
      res <- Maintenance.complete(xa, lorna, plan.id, CompleteReq(Some(LocalDate.now), Some(5000L))).map(_.toOption.get)
    } yield expect(res.nextDue == LocalDate.now.plusMonths(3))
  }

  test("Staff cannot create or complete (403)") { xa =>
    for {
      create <- Maintenance.create(xa, marcia, CreateReq("X", None, None, "monthly", LocalDate.now, None))
      complete <- Maintenance.complete(
        xa,
        marcia,
        UUID.fromString("d0000000-0000-0000-0000-000000000001"),
        CompleteReq(None, None)
      )
    } yield expect(create.left.exists(_._1.code == 403)) and expect(complete.left.exists(_._1.code == 403))
  }
}
