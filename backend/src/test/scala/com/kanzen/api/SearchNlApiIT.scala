package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.search.SearchRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F28 search (permission-filtered — no leak via search) + F32 NL query (read-only, permission-filtered).
  */
object SearchNlApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("F28 — search finds an indexed asset for the Principal but is stripped for Staff (no leak)") { xa =>
    for {
      _ <- SearchRepo.index("asset", UUID.randomUUID(), "Les Paul Standard", Some("Gibson guitar")).transact(xa)
      asPrin <- Search.search(xa, toby, "guitar").map(_.toOption.get)
      asStaff <- Search.search(xa, marcia, "guitar").map(_.toOption.get)
    } yield expect(asPrin.hits.exists(_.title == "Les Paul Standard")) and
      expect(!asStaff.hits.exists(_.entityType == "asset")) // Staff have no asset read → no asset hits
  }

  test("F32 — NL count + last-purchase intents resolve read-only; gibberish is 422") { xa =>
    for {
      count <- NlQuery.query(xa, toby, "how many assets do I have").map(_.toOption.get)
      last <- NlQuery.query(xa, toby, "when did I last buy a watch").map(_.toOption.get)
      huh <- NlQuery.query(xa, toby, "make me a sandwich")
    } yield expect(count.intent.startsWith("count")) and expect(count.count.exists(_ >= 0L)) and
      expect(last.intent == "last_purchase") and
      expect(huh.left.exists(_._1.code == 422))
  }

  test("F32 — Staff cannot run NL registry queries (403, no leak via NL totals)") { xa =>
    NlQuery.query(xa, marcia, "how many assets").map(r => expect(r.left.exists(_._1.code == 403)))
  }
}
