package com.kanzen.asset

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.syntax._
import weaver.IOSuite

import java.time.LocalDate

/** F21 + F24 integration: insurance round-trip + a recorded, explainable restructure op. */
object ProvenanceInsuranceIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("insurance set/get and warranty add") { xa =>
    val prog = for {
      cat <- AssetRepo.createCategory("Watches", None)
      a <- AssetRepo.create("Royal Oak", Some("Audemars Piguet"), cat, "unique", 1, Json.obj())
      _ <- InsuranceRepo.set(a.id, insured = true, Some("Hiscox-2026"), Some(4200000L), Some(LocalDate.now.plusMonths(11)))
      _ <- InsuranceRepo.addWarranty(a.id, Some("Audemars Piguet"), Some(LocalDate.now.plusYears(2)))
      ins <- InsuranceRepo.get(a.id)
    } yield ins
    prog.transact(xa).map(ins => expect(ins.exists(i => i.insured && i.insuredValueMinor.contains(4200000L))))
  }

  test("a split restructure is recorded with explainable cost allocation") { xa =>
    val parts = RestructureService.splitCost(180000L, 6)
    val prog = for {
      id <- RestructureRepo.record(
        "split",
        Json.obj("source" -> "tumblers-set".asJson, "total_minor" -> 180000.asJson),
        Json.obj("allocations" -> parts.asJson),
      )
      fetched <- RestructureRepo.get(id)
    } yield fetched
    prog.transact(xa).map { fetched =>
      expect(parts.sum == 180000L) and expect(fetched.exists(_._1 == "split"))
    }
  }
}
