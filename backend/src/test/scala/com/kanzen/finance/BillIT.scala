package com.kanzen.finance

import cats.effect.IO
import com.kanzen.tenant.Tenant
import cats.syntax.all._
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F15 integration test: recordSeen flags a material variance and persists it. */
object BillIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("a +59% reconciled amount sets the variance flag") { xa =>
    val prog = for {
      b <- BillRepo.create(Tenant.DefaultId, "SP Group", None, None, 38420L, "SGD", Some("monthly"))
      flagged <- BillRepo.recordSeen(b.id, 61280L)
      fetched <- BillRepo.get(b.id, Tenant.DefaultId)
    } yield (flagged, fetched)
    prog.transact(xa).map { case (flagged, fetched) =>
      expect(flagged) and
        expect(fetched.exists(_.varianceFlag)) and
        expect(fetched.exists(_.amountMinor == 61280L))
    }
  }

  test("a small change does not flag variance") { xa =>
    val prog =
      BillRepo.create(Tenant.DefaultId, "Council tax", None, None, 20000L, "GBP", Some("monthly")).flatMap { b =>
        BillRepo.recordSeen(b.id, 20300L).tupleLeft(b.id)
      }
    prog.transact(xa).map { case (_, flagged) => expect(!flagged) }
  }
}
