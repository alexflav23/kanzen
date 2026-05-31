package com.kanzen.db

import cats.effect.IO
import cats.syntax.all._
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** Integration / "server" test: a real Postgres 16 via Testcontainers, Flyway-migrated. */
object MigrationsIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  // One sequential test: the two tests previously shared a transactor and weaver runs a
  // suite's tests in parallel, so the insert below could race ahead of an emptiness count.
  test("baseline migration creates an empty audit_log_entries table that can be written and read back") { xa =>
    val empty = sql"select count(*) from audit_log_entries".query[Long].unique
    val insert =
      sql"insert into audit_log_entries (tenant_id, actor_type, action) values ('7e000000-0000-0000-0000-000000000001'::uuid, 'system', 'boot')".update.run
    val count = sql"select count(*) from audit_log_entries".query[Long].unique
    (for {
      before <- empty
      _ <- insert
      after <- count
    } yield expect(before == 0L) and expect(after == 1L)).transact(xa)
  }
}
