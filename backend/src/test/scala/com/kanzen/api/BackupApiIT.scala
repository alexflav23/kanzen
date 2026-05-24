package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Backup._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F30 — backup/export/restore: self-descriptive archive (AC1), checksum/schema validation
  * (AC2), dry-run that writes nothing (AC3), and a faithful delete→restore round-trip (AC4). */
object BackupApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor
  // these tests assert on global table counts (dry-run writes nothing; round-trip deletes+restores),
  // so they must not run concurrently against the shared transactor — run the suite sequentially.
  override def maxParallelism = 1

  private val toby  = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna = Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")

  test("AC1/AC2 — export yields a manifest with per-section checksums; validate passes, tamper fails") { xa =>
    for {
      exp     <- Backup.export(xa, toby).map(_.toOption.get)
      ok      <- Backup.validate(xa, toby, ValidateReq(exp.archive)).map(_.toOption.get)
      // tamper: drop the assets section's rows → checksum mismatch
      tampered = exp.archive.copy(data = exp.archive.data.updated("assets", Json.arr()))
      bad     <- Backup.validate(xa, toby, ValidateReq(tampered)).map(_.toOption.get)
    } yield expect(exp.manifest.hcursor.downField("section_checksums").succeeded) and
      expect(exp.archive.data.contains("assets")) and
      expect(ok.valid) and expect(!bad.valid) and expect(bad.errors.exists(_.contains("assets")))
  }

  test("AC3 — dry-run reports the plan in dependency order and writes nothing") { xa =>
    for {
      before <- sql"select count(*) from assets".query[Long].unique.transact(xa)
      exp    <- Backup.export(xa, toby).map(_.toOption.get)
      dry    <- Backup.restore(xa, toby, RestoreReq(exp.archive, "dry_run")).map(_.toOption.get)
      after  <- sql"select count(*) from assets".query[Long].unique.transact(xa)
    } yield expect(dry.mode == "dry_run") and expect(dry.applied.isEmpty) and
      expect(dry.wouldApply.getOrElse("assets", 0L) >= 1L) and expect(before == after) // nothing written
  }

  test("AC4 — delete→restore round-trips faithfully (the asset reappears, id + title intact)") { xa =>
    for {
      id    <- sql"insert into assets (owner_id, title) values ($owner, 'Round-trip widget') returning id".query[UUID].unique.transact(xa)
      exp   <- Backup.export(xa, toby).map(_.toOption.get)
      _     <- sql"delete from assets where id = $id".update.run.transact(xa)
      gone  <- sql"select exists(select 1 from assets where id = $id)".query[Boolean].unique.transact(xa)
      res   <- Backup.restore(xa, toby, RestoreReq(exp.archive, "full")).map(_.toOption.get)
      title <- sql"select title from assets where id = $id".query[String].option.transact(xa)
    } yield expect(!gone) and expect(res.mode == "full") and
      expect(res.applied.getOrElse("assets", 0) >= 1) and // only the deleted row reinserts (others conflict-no-op)
      expect(title.contains("Round-trip widget"))
  }

  test("backup is Principal-only — Manager gets 403") { xa =>
    Backup.export(xa, lorna).map(r => expect(r.left.exists(_._1.code == 403)))
  }
}
