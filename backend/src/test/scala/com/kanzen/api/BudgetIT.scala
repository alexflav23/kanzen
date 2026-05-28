package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F17 (W5) — budgets: budget-vs-actual is computed from APPROVED expenses in the period; create/delete + authz. */
object BudgetIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")
  private def lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private def marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  test("the seeded Wardian monthly budget reports £2,000 vs the approved expenses this month") { xa =>
    Expenses.listBudgets(xa, lorna).map { r =>
      val monthly = r.toOption.get.find(b => b.propertyId.contains(wardian) && b.period == "monthly")
      // V2_80 seeds £2,000 budget + £650 of approved Wardian expenses this month (others may add more → >=)
      expect(monthly.exists(b => b.amountMinor == 200000 && b.actualMinor >= 65000))
    }
  }

  test("create a budget, then delete it; a bad period is 400; Staff is denied (403)") { xa =>
    for {
      created <- Expenses.createBudget(
        xa,
        lorna,
        Expenses.CreateBudgetReq(Some(wardian), None, "quarterly", 100000, "GBP")
      )
      badPeriod <- Expenses.createBudget(xa, lorna, Expenses.CreateBudgetReq(None, None, "fortnightly", 100000, "GBP"))
      staff <- Expenses.createBudget(xa, marcia, Expenses.CreateBudgetReq(None, None, "monthly", 100000, "GBP"))
      deleted <- Expenses.deleteBudget(xa, lorna, created.toOption.get.id)
    } yield expect(created.toOption.exists(_.period == "quarterly")) and
      expect(badPeriod.left.exists(_._1.code == 400)) and
      expect(staff.left.exists(_._1.code == 403)) and
      expect(deleted.isRight)
  }
}
