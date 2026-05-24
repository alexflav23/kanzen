package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Agent._
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F25 pipeline · F26 inbox · F27 trust. Emails are classified → proposed; financial/asset categories can never be
  * AUTO-executed (locked); human confirm is the review path.
  */
object AgentApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("F25/F26 — a delivery email classifies + proposes actions; human confirm executes one") { xa =>
    for {
      ing <- Agent
        .ingest(
          xa,
          lorna,
          IngestReq("deliveries@kanzen.family", "amazon", "Your order has been dispatched · delivery Tue")
        )
        .map(_.toOption.get)
      ok <- Agent.confirm(xa, lorna, ing.proposedActionIds.head).map(_.toOption.get)
      dup <- Agent.confirm(xa, lorna, ing.proposedActionIds.head) // already executed
      inbox <- Agent.inbox(xa, toby).map(_.toOption.get)
    } yield expect(ing.category == "Delivery") and expect(ing.proposedActionIds.size == 2) and
      expect(ok.ok) and expect(dup.left.exists(_._1.code == 409)) and
      expect(inbox.counts.getOrElse("agent", 0L) >= 1L)
  }

  test("F27 — a financial (Receipt) action can never be auto-executed (409); human confirm is allowed") { xa =>
    for {
      ing <- Agent
        .ingest(xa, lorna, IngestReq("accounts@kanzen.family", "Selfridges", "Your receipt for the purchase"))
        .map(_.toOption.get)
      act = ing.proposedActionIds.head
      auto <- Agent.autoExecute(xa, lorna, act) // locked → blocked
      conf <- Agent.confirm(xa, lorna, act).map(_.toOption.get) // human review → allowed
    } yield expect(ing.category == "Receipt") and
      expect(auto.left.exists(_._1.code == 409)) and expect(conf.ok)
  }

  test("F27 — trust: a financial category is forced to review; a non-financial one honours auto") { xa =>
    for {
      bill <- Agent.setTrust(xa, toby, SetTrustReq("Bill / Invoice", "auto")).map(_.toOption.get)
      delivery <- Agent.setTrust(xa, toby, SetTrustReq("Delivery", "auto")).map(_.toOption.get)
    } yield expect(bill.routing == "review") and expect(bill.locked) and
      expect(delivery.routing == "auto") and expect(!delivery.locked)
  }

  test("Staff cannot drive the agent pipeline (403)") { xa =>
    Agent.ingest(xa, marcia, IngestReq("x", "y", "z")).map(r => expect(r.left.exists(_._1.code == 403)))
  }
}
