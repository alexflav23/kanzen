package com.kanzen.agent

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F27 integration test: setting a financial category to auto persists as review. */
object TrustIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("financial category forced to review; non-financial honoured") { xa =>
    val prog = for {
      billRouting <- TrustRepo.set("Bill / Invoice", "auto")
      deliveryRouting <- TrustRepo.set("Delivery", "auto")
      billStored <- TrustRepo.get("Bill / Invoice")
    } yield (billRouting, deliveryRouting, billStored)
    prog.transact(xa).map { case (bill, delivery, billStored) =>
      expect(bill == "review") and
        expect(delivery == "auto") and
        expect(billStored.contains("review"))
    }
  }
}
