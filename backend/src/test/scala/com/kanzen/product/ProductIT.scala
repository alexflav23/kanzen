package com.kanzen.product

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F35 integration test: "we're out of eggs (Burford Brown, Harrods)" -> reorder list. */
object ProductIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("marking a product out surfaces it (with its buy link) in the reorder list") { xa =>
    val prog = for {
      eggs <- ProductRepo.create("Eggs", Some("Burford Brown, large"))
      _ <- ProductRepo.addVendor(eggs.id, Some("Harrods"), Some("https://harrods.com/eggs"), preferred = true)
      milk <- ProductRepo.create("Milk", Some("Whole, organic"))
      _ <- ProductRepo.setStock(eggs.id, "out")
      reorder <- ProductRepo.needingReorder
    } yield (eggs, milk, reorder)
    prog.transact(xa).map { case (eggs, _, reorder) =>
      expect(reorder.exists(p => p.id == eggs.id && p.stockStatus == "out")) and
        expect(!reorder.exists(_.name == "Milk"))
    }
  }
}
