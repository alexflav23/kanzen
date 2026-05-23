package com.kanzen.backup

import doobie._
import doobie.implicits._

/** F30 — entity counts for the export manifest. */
object BackupRepo {
  def countEntities: ConnectionIO[Map[String, Long]] =
    for {
      users <- sql"select count(*) from users".query[Long].unique
      assets <- sql"select count(*) from assets".query[Long].unique
      txns <- sql"select count(*) from bank_transactions".query[Long].unique
    } yield Map("users" -> users, "assets" -> assets, "bank_transactions" -> txns)
}
