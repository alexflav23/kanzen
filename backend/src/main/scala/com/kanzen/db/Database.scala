package com.kanzen.db

import cats.effect.{IO, Resource}
import doobie.hikari.HikariTransactor
import doobie.util.ExecutionContexts
import org.flywaydb.core.Flyway

/** F00 DB layer — Flyway migrations + a Doobie HikariTransactor (Hypervolt pattern). */
object Database {

  /** Run Flyway migrations from `resources/db/migration`. Returns migrations applied. */
  def runMigrations(jdbcUrl: String, user: String, pass: String): IO[Int] =
    IO.blocking {
      Flyway
        .configure()
        .dataSource(jdbcUrl, user, pass)
        .baselineOnMigrate(true)
        .load()
        .migrate()
        .migrationsExecuted
    }

  /** A pooled transactor. */
  def transactor(jdbcUrl: String, user: String, pass: String): Resource[IO, HikariTransactor[IO]] =
    for {
      ec <- ExecutionContexts.fixedThreadPool[IO](8)
      xa <- HikariTransactor.newHikariTransactor[IO]("org.postgresql.Driver", jdbcUrl, user, pass, ec)
    } yield xa
}
