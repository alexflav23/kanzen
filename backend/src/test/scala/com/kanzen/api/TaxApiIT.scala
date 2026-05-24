package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Expenses.SubmitReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F38 — tax estimation + deductible report: Principal-only; report aggregates the deductible/VAT flags from approved
  * expenses.
  */
object TaxApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")

  test("income estimate is Principal-only and computes tax + take-home") { xa =>
    for {
      pri <- Tax.incomeEstimate(xa, toby, 6_000_000L).map(_.toOption.get) // £60k
      mgr <- Tax.incomeEstimate(xa, lorna, 6_000_000L)
    } yield expect(pri.estimatedTaxMinor == 1_143_200L) and
      expect(pri.takeHomeMinor == 6_000_000L - 1_143_200L) and
      expect(pri.effectiveRatePct == 19) and
      expect(mgr.left.exists(_._1.code == 403))
  }

  test("the deductible report sums deductible + VAT-reclaimable approved expenses (Principal-only)") { xa =>
    for {
      // a small (auto-approved) deductible + VAT-reclaimable expense
      _ <- Expenses.submit(
        xa,
        lorna,
        SubmitReq(Some("Office supplies"), None, 12_000L, "GBP", None, None, Some(true), Some(true), Some("office"))
      )
      report <- Tax.deductibleReport(xa, toby).map(_.toOption.get)
      mgr <- Tax.deductibleReport(xa, lorna)
    } yield expect(report.deductibleTotalMinor >= 12_000L) and
      expect(report.vatReclaimableTotalMinor >= 12_000L) and
      expect(report.deductibleCount >= 1) and
      expect(mgr.left.exists(_._1.code == 403))
  }
}
