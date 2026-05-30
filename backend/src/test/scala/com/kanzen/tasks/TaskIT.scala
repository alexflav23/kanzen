package com.kanzen.tasks

import com.kanzen.tenant.Tenant
import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F06 integration test: completing a recurring task spawns the next occurrence. */
object TaskIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("completing a one-off task finishes it; a recurring task spawns the next") { xa =>
    val today = LocalDate.now
    val prog = for {
      proj <- TaskRepo.createProject("Wardian", None)
      oneOff <- TaskRepo.createTask(Tenant.DefaultId, proj, "Renew TV licence", Some(today), None)
      recurring <- TaskRepo.createTask(Tenant.DefaultId, proj, "Daikin quarterly service", Some(today), Some("monthly"))
      noNext <- TaskRepo.complete(oneOff.id, Tenant.DefaultId)
      next <- TaskRepo.complete(recurring.id, Tenant.DefaultId)
      oneOffAfter <- TaskRepo.get(oneOff.id, Tenant.DefaultId)
    } yield (noNext, next, oneOffAfter)
    prog.transact(xa).map { case (noNext, next, oneOffAfter) =>
      expect(noNext.isEmpty) and
        expect(next.isDefined) and
        expect(oneOffAfter.exists(_.status == "done"))
    }
  }
}
