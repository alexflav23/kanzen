package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.api.Restructure._
import com.kanzen.asset.{AssetRepo, RestructureRepo}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F24 — legacy onboarding (AC1) + non-destructive, reversible merge (AC3) / split (AC4),
  * proving the invariant that no restructure silently destroys data (AC5). */
object RestructureApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby   = Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna  = Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  private def legacy(xa: Transactor[IO], title: String, cost: Long): IO[UUID] =
    Restructure.legacyCreate(xa, lorna, LegacyCreateReq(title, None, Some(cost), Some("GBP"), None, None)).map(_.toOption.get.id)

  test("AC1 — legacy create stores an uncertainty note and is valid without a receipt") { xa =>
    for {
      c   <- Restructure.legacyCreate(xa, lorna, LegacyCreateReq("Grandmother's clock", None, Some(25000L), Some("GBP"), None, Some("Inherited c. 1990")))
      id   = c.toOption.get.id
      note <- sql"select uncertainty_note from assets where id = $id".query[Option[String]].unique.transact(xa)
      ok   <- AssetRepo.exists(id).transact(xa)
    } yield expect(ok) and expect(note.contains("Inherited c. 1990"))
  }

  test("AC3 — merge sums cost basis, preserves lineage, supersedes (not deletes) the merged, and reverses") { xa =>
    for {
      sv  <- legacy(xa, "Dyson V15 (a)", 100000L)
      mg  <- legacy(xa, "Dyson V15 (b)", 50000L)
      res <- Restructure.merge(xa, toby, MergeReq(sv, mg)).map(_.toOption.get)
      svCost <- RestructureRepo.assetCost(sv).transact(xa)
      mgGone <- RestructureRepo.isSuperseded(mg).transact(xa)
      mgStillExists <- AssetRepo.exists(mg).transact(xa)               // AC5 — not deleted
      lineage <- sql"select restructured_from from assets where id = $sv".query[Option[Json]].unique.transact(xa)
      // reverse restores both originals
      rev <- Restructure.reverse(xa, toby, res.opId).map(_.toOption.get)
      svCost2 <- RestructureRepo.assetCost(sv).transact(xa)
      mgBack  <- RestructureRepo.isSuperseded(mg).transact(xa)
    } yield expect(res.combinedCostMinor == 150000L) and expect(svCost.contains(150000L)) and
      expect(mgGone) and expect(mgStillExists) and
      expect(lineage.exists(_.spaces2.contains(mg.toString))) and
      expect(rev.kind == "merge") and expect(svCost2.contains(100000L)) and expect(!mgBack)
  }

  test("AC4 — split allocates cost across children summing to the original; parent superseded not deleted") { xa =>
    for {
      p   <- legacy(xa, "Set of 6 crystal tumblers", 60000L)
      res <- Restructure.split(xa, lorna, SplitReq(p, 6)).map(_.toOption.get)
      parents <- res.childIds.traverse(cid => sql"select parent_asset_id from assets where id = $cid".query[Option[UUID]].unique).transact(xa)
      parentGone <- RestructureRepo.isSuperseded(p).transact(xa)
      parentExists <- AssetRepo.exists(p).transact(xa)
    } yield expect(res.childIds.size == 6) and
      expect(res.allocatedMinor.sum == 60000L) and expect(res.allocatedMinor.forall(_ == 10000L)) and
      expect(parents.forall(_.contains(p))) and
      expect(parentGone) and expect(parentExists) // AC5 — original kept
  }

  test("Staff cannot legacy-create or merge (403)") { xa =>
    for {
      lc <- Restructure.legacyCreate(xa, marcia, LegacyCreateReq("X", None, None, None, None, None))
      mg <- Restructure.merge(xa, marcia, MergeReq(UUID.randomUUID(), UUID.randomUUID()))
    } yield expect(lc.left.exists(_._1.code == 403)) and expect(mg.left.exists(_._1.code == 403))
  }
}
