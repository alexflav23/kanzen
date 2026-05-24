package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Finance.{CreateBillReq, MethodReq, ScheduleReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F15/F16 — bills (variance) + pay queue. Invariant: Kanzen never moves money — only
  * manual payments can be marked paid; auto/review cannot (409). Finance carve-out. */
object FinanceApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna  = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  test("bills list includes the seeded schedule; Staff is denied (403)") { xa =>
    for {
      bills <- Finance.listBills(xa, lorna).map(_.toOption.get)
      staff <- Finance.listBills(xa, marcia)
    } yield expect(bills.exists(_.payee == "Thames Water")) and expect(staff.left.exists(_._1.code == 403))
  }

  test("recording an observed amount flags a >=±15% variance") { xa =>
    for {
      bill <- Finance.createBill(xa, lorna, CreateBillReq("EDF Energy", None, 10000L, "GBP", Some("monthly"))).map(_.toOption.get)
      same <- Finance.recordSeen(xa, lorna, bill.id, 10500L).map(_.toOption.get) // +5% → no flag
      big  <- Finance.recordSeen(xa, lorna, bill.id, 13000L).map(_.toOption.get) // vs 10500 → +23.8% → flag
    } yield expect(!same.varianceFlag) and expect(big.varianceFlag)
  }

  test("a manual payment can be marked paid; an auto payment cannot (never moves money)") { xa =>
    for {
      method   <- Finance.createMethod(xa, lorna, MethodReq("bank_account", "Coutts current", Some("1234"), Some("GBP"), Some("1Password: Coutts"))).map(_.toOption.get)
      manual   <- Finance.schedule(xa, lorna, ScheduleReq(None, Some(method.id), 20000L, "GBP", "manual")).map(_.toOption.get)
      auto     <- Finance.schedule(xa, lorna, ScheduleReq(None, Some(method.id), 38420L, "GBP", "auto")).map(_.toOption.get)
      paid     <- Finance.markPaid(xa, lorna, manual.id)
      autoPaid <- Finance.markPaid(xa, lorna, auto.id)
    } yield expect(paid.toOption.exists(_.state == "paid")) and
      expect(autoPaid.left.exists(_._1.code == 409)) // auto settles externally — Kanzen never moves money
  }

  test("the pay queue lists scheduled payments") { xa =>
    for {
      m <- Finance.createMethod(xa, lorna, MethodReq("credit_card", "Amex", Some("9999"), Some("GBP"), None)).map(_.toOption.get)
      _ <- Finance.schedule(xa, lorna, ScheduleReq(None, Some(m.id), 5000L, "GBP", "manual"))
      q <- Finance.queue(xa, lorna).map(_.toOption.get)
    } yield expect(q.nonEmpty)
  }

  test("Staff cannot schedule or mark paid (403)") { xa =>
    for {
      sched <- Finance.schedule(xa, marcia, ScheduleReq(None, None, 100L, "GBP", "manual"))
    } yield expect(sched.left.exists(_._1.code == 403))
  }
}
