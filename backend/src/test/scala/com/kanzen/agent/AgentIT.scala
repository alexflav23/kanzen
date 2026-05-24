package com.kanzen.agent

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F25 integration test: ingest -> classify -> propose actions. */
object AgentIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("a delivery email is classified and its actions proposed") { xa =>
    val prog = for {
      ingested <- AgentRepo.ingest(
        "deliveries@kanzen.family",
        "amazon",
        "Your order has been dispatched · delivery Tue"
      )
      emailId = ingested._1
      category = ingested._2
      actionIds <- AgentService.proposedActions(category).traverse(a => AgentRepo.propose(emailId, a))
      inv <- AgentRepo.ingest("accounts@kanzen.family", "SP Group", "May invoice available S$612.80")
    } yield (category, actionIds.size, inv._2)
    prog.transact(xa).map { case (category, actionCount, invCategory) =>
      expect(category == "Delivery") and
        expect(actionCount == 2) and
        expect(invCategory == "Bill / Invoice")
    }
  }
}
