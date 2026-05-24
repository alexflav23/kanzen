package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Receipts.{CreateReq, LineIn}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.receipt.ReceiptService
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F13 — receipts + line items: brand normalisation, line-item persistence, product-level
  * spend (F32), and the finance carve-out authz (Staff 403). */
object ReceiptsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna  = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  test("brandNorm normalises a free-text line to a stable key") {
    IO.pure(
      expect(ReceiptService.brandNorm("Coca-Cola 330ml x6") == "coca-cola") and
        expect(ReceiptService.brandNorm("Coca Cola 330ml") == "coca-cola") and
        expect(ReceiptService.brandNorm("Waitrose Whole Milk 2L") == "waitrose-whole-milk"),
    )
  }

  test("a receipt is created with brand-normalised line items; Staff is denied (403)") { xa =>
    val req = CreateReq(Some("receipt"), Some("Waitrose"), Some(8990L), Some("GBP"), List(
      LineIn(Some("Coca-Cola 330ml x6"), Some(4500L), Some("GBP"), Some("groceries")),
      LineIn(Some("Waitrose Whole Milk 2L"), Some(2490L), Some("GBP"), Some("groceries")),
    ))
    for {
      created <- Receipts.create(xa, lorna, req).map(_.toOption.get)
      denied  <- Receipts.create(xa, marcia, req)
    } yield expect(created.lines.size == 2) and
      expect(created.lines.exists(_.brandNorm.contains("coca-cola"))) and
      expect(denied.left.exists(_._1.code == 403))
  }

  test("product-level spend sums line items by brand across receipts (F32)") { xa =>
    val mk = (n: Int) => CreateReq(Some("receipt"), Some("Shop"), Some(150L * n), Some("GBP"),
      List(LineIn(Some(s"Coca-Cola 330ml"), Some(150L), Some("GBP"), None)))
    for {
      _     <- Receipts.create(xa, lorna, mk(1))
      _     <- Receipts.create(xa, lorna, mk(1))
      spend <- Receipts.spend(xa, lorna, "Coca-Cola").map(_.toOption.get)
    } yield expect(spend.brand == "coca-cola") and expect(spend.totalMinor >= 300L) // ≥ the two we just added
  }

  test("Staff cannot read receipts (403)") { xa =>
    Receipts.list(xa, marcia).map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("confirming a line item sets its category; unknown line → 404") { xa =>
    val req = CreateReq(Some("receipt"), Some("Shop"), Some(150L), Some("GBP"), List(LineIn(Some("Item 1"), Some(150L), Some("GBP"), None)))
    for {
      r    <- Receipts.create(xa, lorna, req).map(_.toOption.get)
      line  = r.lines.head
      ok   <- Receipts.confirmLine(xa, lorna, r.receipt.id, line.id, "household")
      bad  <- Receipts.confirmLine(xa, lorna, r.receipt.id, UUID.randomUUID(), "household")
    } yield expect(ok.isRight) and expect(bad.left.exists(_._1.code == 404))
  }
}
