package com.kanzen.lists

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** F08 integration test: the "we're out of Dove Shower Gel" propose -> approve flow. */
object ListIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("staff proposes an item (needs approval) -> Principal approves -> added; recurring goes straight in") { xa =>
    val prog = for {
      list <- ListRepo.createList(None, "Wardian household supplies", Some("Waitrose"))
      doveProposed <- ListRepo.addItem(list, "Dove Shower Gel", 2, recurring = false, Some("https://amazon.co.uk/dove"), proposedByStaff = true)
      _ <- ListRepo.approve(doveProposed.id)
      eggs <- ListRepo.addItem(list, "Eggs (Burford Brown)", 1, recurring = true, Some("https://harrods.com/eggs"), proposedByStaff = true)
      items <- ListRepo.items(list)
    } yield (doveProposed, eggs, items)

    prog.transact(xa).map { case (dove, eggs, items) =>
      expect(dove.status == "needs_approval") and
        expect(eggs.status == "added") and
        expect(items.size == 2) and
        expect(items.exists(i => i.name.startsWith("Dove") && i.status == "added")) and
        expect(items.exists(_.url.contains("https://harrods.com/eggs")))
    }
  }
}
