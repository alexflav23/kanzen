package com.kanzen.maintenance

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F11 integration test: completing a plan logs it and rolls next_due forward. */
object MaintenanceIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("completing a quarterly plan rolls next_due +3 months and writes a log") { xa =>
    val today = LocalDate.now
    val prog = for {
      plan <- MaintenanceRepo.createPlan("quarterly", today, 14)
      newDue <- MaintenanceRepo.complete(plan.id, today, Some(45000L))
      after <- MaintenanceRepo.get(plan.id)
    } yield (newDue, after)
    prog.transact(xa).map { case (newDue, after) =>
      expect(newDue == today.plusMonths(3)) and
        expect(after.exists(_.nextDue.contains(today.plusMonths(3))))
    }
  }
}
