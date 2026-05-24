package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F23 — completeness scoring (AC1), registry health (AC2), the data-quality flag stream, and registry-private access
  * (Staff none).
  */
object DataQualityIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private def insertBare(xa: Transactor[IO], title: String): IO[UUID] =
    sql"insert into assets (owner_id, title) values ($owner, $title) returning id".query[UUID].unique.transact(xa)

  test("AC1 — a bare asset scores 0 with all checks missing; adding a category recomputes upward") { xa =>
    for {
      id <- insertBare(xa, "QA widget")
      c0 <- DataQuality.completeness(xa, toby, id).map(_.toOption.get)
      cat <- sql"select id from categories limit 1".query[UUID].unique.transact(xa)
      _ <- sql"update assets set category_id = $cat where id = $id".update.run.transact(xa)
      c1 <- DataQuality.completeness(xa, toby, id).map(_.toOption.get)
    } yield expect(c0.score == 0) and
      expect(c0.missing.toSet == Set("photo", "category", "location", "proof")) and
      expect(c1.score == 25) and expect(!c1.missing.contains("category"))
  }

  test("AC2 — registry health aggregates over the seeded registry with bounded percentages") { xa =>
    DataQuality.registryHealth(xa, toby).map(_.toOption.get).map { h =>
      expect(h.total > 0L) and
        expect(h.photographedPct >= 0 && h.photographedPct <= 100) and
        expect(h.categorisedPct >= 0 && h.categorisedPct <= 100)
    }
  }

  test("scan raises flags; a flag can be resolved and leaves the open stream") { xa =>
    for {
      id <- insertBare(xa, "Flagless gadget")
      scanned <- DataQuality.scan(xa, toby).map(_.toOption.get)
      stream0 <- DataQuality.stream(xa, toby).map(_.toOption.get)
      mine = stream0.find(f => f.assetId.contains(id) && f.kind == "no_category").get
      ok <- DataQuality.resolve(xa, toby, mine.id, "resolved").map(_.toOption.get)
      stream1 <- DataQuality.stream(xa, toby).map(_.toOption.get)
    } yield expect(scanned.flagsRaised >= 1) and expect(ok.ok) and
      expect(!stream1.exists(_.id == mine.id))
  }

  test("registry-private: Staff get 403 on completeness; Manager reads the stream but cannot scan") { xa =>
    for {
      id <- insertBare(xa, "Private item")
      staffDenied <- DataQuality.completeness(xa, marcia, id)
      mgrStream <- DataQuality.stream(xa, lorna)
      mgrScan <- DataQuality.scan(xa, lorna)
    } yield expect(staffDenied.left.exists(_._1.code == 403)) and
      expect(mgrStream.isRight) and
      expect(mgrScan.left.exists(_._1.code == 403)) // scan is Principal-write only
  }
}
