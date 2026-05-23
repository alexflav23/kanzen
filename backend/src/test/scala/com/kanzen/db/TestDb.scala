package com.kanzen.db

import cats.effect.{IO, Resource}
import com.dimafeng.testcontainers.PostgreSQLContainer
import doobie.util.transactor.Transactor
import org.testcontainers.utility.DockerImageName

/** Shared integration-test fixture: a fresh Flyway-migrated Postgres 16 (Testcontainers). */
object TestDb {
  val transactor: Resource[IO, Transactor[IO]] = {
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
}
