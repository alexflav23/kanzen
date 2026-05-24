package com.kanzen.people

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F10 integration test: expiring-permit query (soon-to-expire surfaces, far-future doesn't). */
object PeopleIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")

  test("expiringPermits(60) surfaces a soon-to-expire permit but not a far-future one") { xa =>
    val prog = for {
      soon <- PeopleRepo.insert(owner, None, "Test Soon", Some("Housekeeper"), Some("sg"), None, Some(LocalDate.now.plusDays(50)), None)
      far  <- PeopleRepo.insert(owner, None, "Test Far", Some("Housekeeper"), Some("uk"), None, Some(LocalDate.now.plusDays(300)), None)
      expiring <- PeopleRepo.expiringPermits(60)
    } yield (soon, far, expiring)
    prog.transact(xa).map { case (soon, far, expiring) =>
      expect(expiring.exists(_.id == soon.id)) and expect(!expiring.exists(_.id == far.id))
    }
  }
}
