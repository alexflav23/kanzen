package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Expenses.SubmitReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F17 — expenses & approvals: threshold routing, over-threshold → Principal, deductibility flags, finance carve-out
  * (Staff 403).
  */
object ExpensesApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  private def req(amount: Long, deductible: Boolean = false) =
    SubmitReq(
      Some("HVAC"),
      Some("quarterly"),
      amount,
      "GBP",
      None,
      None,
      Some(deductible),
      Some(false),
      Some("repairs")
    )

  test("below threshold auto-approves; above threshold routes to pending_approval") { xa =>
    for {
      small <- Expenses.submit(xa, lorna, req(10000L)).map(_.toOption.get) // £100
      big <- Expenses.submit(xa, lorna, req(184000L)).map(_.toOption.get) // £1,840 ≥ £1,500
    } yield expect(small.status == "approved") and expect(big.status == "pending_approval")
  }

  test("over-threshold approval requires the Principal (Manager denied 403)") { xa =>
    for {
      e <- Expenses.submit(xa, lorna, req(184000L)).map(_.toOption.get)
      mgr <- Expenses.approve(xa, lorna, e.id) // Manager can't approve over-threshold
      pri <- Expenses.approve(xa, toby, e.id) // Principal can
    } yield expect(mgr.left.exists(_._1.code == 403)) and expect(pri.toOption.exists(_.status == "approved"))
  }

  test("the Principal can reject an over-threshold expense") { xa =>
    for {
      e <- Expenses.submit(xa, lorna, req(200000L)).map(_.toOption.get)
      rej <- Expenses.reject(xa, toby, e.id)
    } yield expect(rej.toOption.exists(_.status == "rejected"))
  }

  test("deductibility flag is persisted (F38)") { xa =>
    Expenses.submit(xa, lorna, req(5000L, deductible = true)).map(r => expect(r.toOption.exists(_.deductible)))
  }

  test("Staff cannot submit or list expenses (403)") { xa =>
    for {
      sub <- Expenses.submit(xa, marcia, req(100L))
      list <- Expenses.list(xa, marcia, None)
    } yield expect(sub.left.exists(_._1.code == 403)) and expect(list.left.exists(_._1.code == 403))
  }

  test("list filters by status") { xa =>
    for {
      _ <- Expenses.submit(xa, lorna, req(184000L)) // pending_approval
      pending <- Expenses.list(xa, toby, Some("pending_approval")).map(_.toOption.get)
    } yield expect(pending.nonEmpty) and expect(pending.forall(_.status == "pending_approval"))
  }

  // F34 — the drift bar for the expense-approval flow. The realtime layer (F48) live-updates the approvals queue +
  // notifications fan out off these. A fresh over-threshold expense per run → race-proof aggregate_id.
  test("F34 — expense mutations emit expense.{submitted,approved}; reject emits expense.rejected") { xa =>
    for {
      e <- Expenses.submit(xa, lorna, req(184000L)).map(_.toOption.get) // submitted (pending — over threshold)
      _ <- Expenses.approve(xa, toby, e.id).map(_.toOption.get) // approved (Principal)
      r <- Expenses.submit(xa, lorna, req(200000L)).map(_.toOption.get)
      _ <- Expenses.reject(xa, toby, r.id).map(_.toOption.get) // rejected (Principal)
      eEvents <-
        sql"select event_type from event_outbox where aggregate_id = ${e.id}".query[String].to[List].transact(xa)
      rEvents <-
        sql"select event_type from event_outbox where aggregate_id = ${r.id}".query[String].to[List].transact(xa)
    } yield expect(eEvents.contains("expense.submitted")) and
      expect(eEvents.contains("expense.approved")) and
      expect(rEvents.contains("expense.submitted")) and
      expect(rEvents.contains("expense.rejected"))
  }
}
