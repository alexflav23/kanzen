package com.kanzen.finance

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F16 integration test: manual bill payment marks paid; auto stays scheduled. */
object PaymentIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("a manual payment can be marked paid; an auto payment cannot") { xa =>
    val prog = for {
      pm <- PaymentRepo.createMethod("bank_account", "Coutts current", Some("1234"), Some("GBP"), Some("1Password: Coutts"))
      manual <- PaymentRepo.schedule(None, Some(pm.id), 20000L, "GBP", "manual")
      auto <- PaymentRepo.schedule(None, Some(pm.id), 38420L, "GBP", "auto")
      manualMarked <- PaymentRepo.markPaid(manual.id)
      autoMarked <- PaymentRepo.markPaid(auto.id)
      m <- PaymentRepo.get(manual.id)
      a <- PaymentRepo.get(auto.id)
    } yield (manualMarked, autoMarked, m, a)
    prog.transact(xa).map { case (manualMarked, autoMarked, m, a) =>
      expect(manualMarked == 1) and
        expect(autoMarked == 0) and
        expect(m.exists(_.state == "paid")) and
        expect(a.exists(_.state == "scheduled"))
    }
  }
}
