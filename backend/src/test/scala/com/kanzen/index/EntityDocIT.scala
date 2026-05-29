package com.kanzen.index

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.api.NlQuery
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F32 / NL-2 — the RAG index: render + index every group, FTS retrieval, idempotent upsert, NL's RAG fallback. */
object EntityDocIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")

  test("render+index assets → FTS-retrievable, idempotent, and NL falls back to RAG for open questions") { xa =>
    for {
      ids <- AssetDocRenderer.allIds.transact(xa)
      _ <- ids.traverse_(IndexConsumer.indexAsset).transact(xa) // backfill
      // count asset docs specifically — the reconcile test runs in parallel and indexes other groups
      c1 <- EntityDocRepo.countOf("asset").transact(xa)
      _ <- ids.traverse_(IndexConsumer.indexAsset).transact(xa) // re-index — upsert, must not duplicate
      c2 <- EntityDocRepo.countOf("asset").transact(xa)
      hits <- EntityDocRepo.search("Royal Oak", 3).transact(xa)
      body = hits.headOption.map(_.body.toLowerCase).getOrElse("")
      // an open-ended question with no structured intent → RAG answer (extractive in sandbox)
      ragE <- NlQuery.query(xa, toby, "tell me about the Royal Oak")
    } yield expect(ids.nonEmpty) and
      expect(c1 > 0L) and // backfill produced docs
      expect(c2 == c1) and // idempotent upsert, not insert
      expect(hits.exists(_.title.toLowerCase.contains("royal oak"))) and
      expect(body.contains("located at")) and // the renderer captured current state
      expect(ragE.exists(_.intent == "rag")) and
      expect(ragE.exists(_.answer.toLowerCase.contains("royal oak")))
  }

  test("NL-2b — the reconcile pass indexes people, properties and documents too (all four groups retrievable)") { xa =>
    for {
      n <- IndexReconcile.run(xa) // backfills every group
      again <- IndexReconcile.run(xa) // idempotent — same population
      // each group lands its own entity_type and is FTS-retrievable
      person <- EntityDocRepo.search("housekeeper", 5).transact(xa)
      property <- EntityDocRepo.search("Wardian apartment", 5).transact(xa)
      // an open-ended question about a *person* now resolves via RAG (no structured intent matched)
      whoIs <- NlQuery.query(xa, toby, "tell me about Marcia")
    } yield expect(n > 0) and expect(again == n) and
      expect(person.exists(_.entityType == "person") || property.exists(_.entityType == "property")) and
      expect(property.exists(_.entityType == "property")) and
      expect(whoIs.exists(_.intent == "rag"))
  }
}
