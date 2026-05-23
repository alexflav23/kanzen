package com.kanzen.vendor

import cats.effect.IO
import com.kanzen.db.TestDb
import com.kanzen.property.PropertyRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F09 integration test: only property-approved + insured vendors are selectable. */
object VendorIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("expired-insurance vendor is excluded from a property's selectable list") { xa =>
    val prog = for {
      p <- PropertyRepo.create("Wardian", None, Some("uk"), "GBP")
      insured <- VendorRepo.create("Hudson Sandler", Some("HVAC"), Some(LocalDate.now.plusYears(1)))
      expired <- VendorRepo.create("Old Plumbing Co", Some("Plumbing"), Some(LocalDate.now.minusDays(10)))
      _ <- VendorRepo.approveForProperty(insured.id, p.id)
      _ <- VendorRepo.approveForProperty(expired.id, p.id)
      selectable <- VendorRepo.selectableFor(p.id)
    } yield (insured, selectable)
    prog.transact(xa).map { case (insured, selectable) =>
      expect(selectable.size == 1) and expect(selectable.exists(_.id == insured.id))
    }
  }
}
