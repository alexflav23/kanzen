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

  test("baseline migration creates an empty audit_log_entries table") { xa =>
    sql"select count(*) from audit_log_entries".query[Long].unique.transact(xa).map(n => expect(n == 0L))
  }

  test("an audit entry can be written and read back") { xa =>
    val insert = sql"insert into audit_log_entries (actor_type, action) values ('system', 'boot')".update.run
    val count = sql"select count(*) from audit_log_entries".query[Long].unique
    (insert *> count).transact(xa).map(n => expect(n == 1L))
  }
}
