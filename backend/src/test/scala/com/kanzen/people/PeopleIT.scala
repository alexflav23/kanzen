package com.kanzen.people

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F10 integration test: expiring-permit query (Siti within 60 days, others not). */
object PeopleIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("expiringPermits(60) surfaces only the soon-to-expire permit") { xa =>
    val prog = for {
      siti <- PeopleRepo.create("Siti", Some("Housekeeper"), Some("sg"), Some(LocalDate.now.plusDays(50)))
      _ <- PeopleRepo.create("Marcia", Some("Housekeeper"), Some("uk"), Some(LocalDate.now.plusDays(300)))
      expiring <- PeopleRepo.expiringPermits(60)
    } yield (siti, expiring)
    prog.transact(xa).map { case (siti, expiring) =>
      expect(expiring.size == 1) and expect(expiring.exists(_.id == siti.id))
    }
  }
}
