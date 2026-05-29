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
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
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

  test("F32 — broadened intents: spend (finance), due-soon (household), where-is + value (registry depth)") { xa =>
    for {
      spend <- NlQuery.query(xa, toby, "how much did I spend on maintenance this year").map(_.toOption.get)
      due <- NlQuery.query(xa, toby, "what's due this week").map(_.toOption.get)
      worth <- NlQuery.query(xa, toby, "what's my registry worth").map(_.toOption.get)
      watches <- NlQuery.query(xa, toby, "how much are my watches worth").map(_.toOption.get)
      where <- NlQuery.query(xa, toby, "where is my Royal Oak").map(_.toOption.get)
    } yield expect(spend.intent == "spend") and expect(spend.answer.contains("£")) and
      expect(due.intent == "due_soon") and expect(due.count.exists(_ >= 0L)) and
      expect(worth.intent == "value_by_category") and
      // a named category answers for THAT category, not the whole portfolio
      expect(watches.intent == "category_value") and expect(watches.answer.toLowerCase.contains("watch")) and
      expect(where.intent == "where_is") and expect(where.answer.contains("Royal Oak"))
  }

  test("F32 NL-2b — crisp single-fact intents resolve against the seed (service · insurance cover · last-in)") { xa =>
    for {
      service <- NlQuery.query(xa, toby, "when is my car next due a service").map(_.toOption.get)
      insure <- NlQuery.query(xa, toby, "how much is my car insurance").map(_.toOption.get)
      lastIn <- NlQuery.query(xa, toby, "when was the housekeeper last in").map(_.toOption.get)
    } yield expect(service.intent == "service_due") and expect(service.answer.toLowerCase.contains("service")) and
      // the seeded vehicle is the Range Rover; "car" resolves to the vehicle vertical
      expect(service.answer.contains("Range Rover")) and
      expect(insure.intent == "insurance") and expect(insure.answer.contains("Hiscox")) and
      expect(insure.answer.contains("£")) and // cover amount, not a premium
      expect(lastIn.intent == "last_activity") and expect(lastIn.answer.contains("Housekeeping"))
  }

  test("F32 — 'what vehicles do I own' returns a formatted list (items), not a raw doc dump") { xa =>
    NlQuery.query(xa, toby, "what vehicles do I own").map(_.toOption.get).map { r =>
      expect(r.intent == "list") and expect(r.items.nonEmpty) and
        expect(r.items.exists(_.title.contains("Range Rover"))) and
        expect(r.answer.toLowerCase.contains("you own"))
    }
  }

  test("F32 NL is Principal-only in v1: a Manager is also denied (403)") { xa =>
    val lorna = Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
    NlQuery.query(xa, lorna, "how much did I spend").map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("F32 — Staff cannot run NL registry queries (403, no leak via NL totals)") { xa =>
    NlQuery.query(xa, marcia, "how many assets").map(r => expect(r.left.exists(_._1.code == 403)))
  }
}
