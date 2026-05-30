package com.kanzen.finance

import cats.effect.IO
import com.kanzen.tenant.Tenant
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F17 integration test: threshold routing persists; approval transitions. */
object ExpenseIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("above-threshold expense persists as pending_approval, then approves") { xa =>
    val prog = for {
      e <- ExpenseRepo.create(Some("HVAC quarterly"), 184000L, "GBP", Some(UUID.randomUUID()))
      afterCreate <- ExpenseRepo.get(e.id, Tenant.DefaultId)
      _ <- ExpenseRepo.approve(e.id, Tenant.DefaultId, UUID.randomUUID())
      afterApprove <- ExpenseRepo.get(e.id, Tenant.DefaultId)
    } yield (afterCreate, afterApprove)
    prog.transact(xa).map { case (created, approved) =>
      expect(created.exists(_.status == "pending_approval")) and
        expect(approved.exists(_.status == "approved"))
    }
  }

  test("below-threshold expense persists as approved") { xa =>
    ExpenseRepo
      .create(Some("Stationery"), 5000L, "GBP", None)
      .transact(xa)
      .map(e => expect(e.status == "approved"))
  }
}
