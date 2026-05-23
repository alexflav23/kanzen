package com.kanzen.db

import cats.effect.{IO, Resource}
import cats.syntax.all._
import com.dimafeng.testcontainers.PostgreSQLContainer
import doobie.implicits._
import doobie.util.transactor.Transactor
import org.testcontainers.utility.DockerImageName
import weaver.IOSuite

/** Integration / "server" test: a real Postgres 16 via Testcontainers, Flyway-migrated,
  * exercised with Doobie. Mirrors the Hypervolt athena weaver + testcontainers pattern.
  */
object MigrationsIT extends IOSuite {
  type Res = Transactor[IO]

  override def sharedResource: Resource[IO, Transactor[IO]] = {
    val start = IO.blocking {
      val c = PostgreSQLContainer(DockerImageName.parse("postgres:16"))
      c.start()
      c
    }
    Resource.make(start)(c => IO.blocking(c.stop())).flatMap { c =>
      Resource
        .eval(Database.runMigrations(c.jdbcUrl, c.username, c.password))
        .flatMap(_ => Database.transactor(c.jdbcUrl, c.username, c.password))
    }
  }

  test("baseline migration creates an empty audit_log_entries table") { xa =>
    sql"select count(*) from audit_log_entries".query[Long].unique.transact(xa).map(n => expect(n == 0L))
  }

  test("an audit entry can be written and read back") { xa =>
    val insert = sql"insert into audit_log_entries (actor_type, action) values ('system', 'boot')".update.run
    val count = sql"select count(*) from audit_log_entries".query[Long].unique
    (insert *> count).transact(xa).map(n => expect(n == 1L))
  }
}
