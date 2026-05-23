package com.kanzen.inbox

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.agent.{AgentRepo, AgentService}
import com.kanzen.bank.{BankRepo, TxIn}
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F26 integration test: Inbox stream counts reflect proposals + unmatched transactions. */
object InboxIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("inbox counts aggregate agent proposals and unmatched transactions") { xa =>
    val prog = for {
      ingested <- AgentRepo.ingest("deliveries@kanzen.family", "amazon", "Order dispatched · delivery")
      emailId = ingested._1
      category = ingested._2
      _ <- AgentService.proposedActions(category).traverse(a => AgentRepo.propose(emailId, a))
      acct <- BankRepo.createAccount("Coutts", "GBP", Some("current"))
      _ <- BankRepo.ingest(acct.id, List(TxIn("inbox-1", LocalDate.now, 4200L, "GBP", "debit", "Waitrose")))
      counts <- InboxRepo.counts
    } yield counts
    prog.transact(xa).map { counts =>
      expect(counts.getOrElse("agent", 0L) >= 2L) and
        expect(counts.getOrElse("reconciliation", 0L) >= 1L)
    }
  }
}
