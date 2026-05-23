package com.kanzen.backup

import cats.effect.IO
import com.kanzen.db.TestDb
import com.kanzen.identity.UserRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F30 integration test: count live entities and build a self-descriptive manifest. */
object BackupIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("entity counts feed a manifest with a checksum") { xa =>
    val prog = for {
      _ <- UserRepo.create("Toby", s"toby+${UUID.randomUUID()}@kanzen.family", "principal")
      counts <- BackupRepo.countEntities
    } yield counts
    prog.transact(xa).map { counts =>
      val m = BackupService.manifest(counts)
      expect(counts.getOrElse("users", 0L) >= 1L) and
        expect(m.hcursor.get[String]("counts_checksum").toOption.exists(_.nonEmpty))
    }
  }
}
