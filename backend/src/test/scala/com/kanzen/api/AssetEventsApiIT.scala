package com.kanzen.api

import com.kanzen.tenant.Tenant
import cats.effect.IO
import com.kanzen.api.AssetEvents.LogReq
import com.kanzen.asset.AssetRepo
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F19 — lifecycle events: Manager logs + reads the timeline + lifetime cost; Staff have no registry access (403);
  * invalid type rejected.
  */
object AssetEventsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  private def newAsset(xa: Transactor[IO]): IO[UUID] =
    (for {
      cat <- AssetRepo.createCategory("Watches", None)
      a <- AssetRepo.create("Royal Oak", Some("AP"), cat, "unique", 1, Json.obj())
    } yield a.id).transact(xa)

  test("Manager logs events; the timeline + lifetime cost accumulate") { xa =>
    for {
      id <- newAsset(xa)
      _ <- AssetEvents.log(xa, lorna, id, LogReq("acquired", Some(3_500_000L), Some("GBP"), Some("Dealer")))
      _ <- AssetEvents.log(xa, lorna, id, LogReq("serviced", Some(45_000L), Some("GBP"), Some("AP service")))
      _ <- AssetEvents.log(xa, lorna, id, LogReq("cleaned", None, None, None))
      tl <- AssetEvents.timeline(xa, toby, id).map(_.toOption.get)
    } yield expect(tl.events.size == 3) and expect(tl.lifetimeCostMinor == 3_545_000L) and
      expect(tl.events.exists(_.eventType == "serviced"))
  }

  test("Staff have no access to the timeline (403) and cannot log events (403)") { xa =>
    for {
      id <- newAsset(xa)
      tl <- AssetEvents.timeline(xa, marcia, id)
      lg <- AssetEvents.log(xa, marcia, id, LogReq("cleaned", None, None, None))
    } yield expect(tl.left.exists(_._1.code == 403)) and expect(lg.left.exists(_._1.code == 403))
  }

  test("an invalid event type is rejected (400)") { xa =>
    newAsset(xa)
      .flatMap(id => AssetEvents.log(xa, lorna, id, LogReq("banana", None, None, None)))
      .map(r => expect(r.left.exists(_._1.code == 400)))
  }

  test("logging against a non-existent asset is 404") { xa =>
    AssetEvents
      .log(xa, lorna, UUID.randomUUID(), LogReq("cleaned", None, None, None))
      .map(r => expect(r.left.exists(_._1.code == 404)))
  }

  // ── W2.2 (F19 §6) — rich log-event: party, backdate, ownership side-effects, audit ──
  test("AC3 — a disposal event closes the asset (sold → ownership_status)") { xa =>
    for {
      id <- newAsset(xa)
      _ <- AssetEvents.log(
        xa,
        toby,
        id,
        LogReq("sold", Some(4_000_000L), Some("GBP"), Some("Auction"), party = Some("Christie's"))
      )
      a <- AssetRepo.get(id, Tenant.DefaultId).transact(xa)
    } yield expect(a.exists(_.ownershipStatus == "sold"))
  }

  test("AC5 — a backdated event re-sorts into the timeline; party persists") { xa =>
    for {
      id <- newAsset(xa)
      _ <- AssetEvents.log(
        xa,
        lorna,
        id,
        LogReq("serviced", Some(45_000L), Some("GBP"), Some("Annual"), party = Some("AP Service"))
      )
      _ <- AssetEvents.log(
        xa,
        lorna,
        id,
        LogReq("acquired", Some(3_500_000L), Some("GBP"), None, occurredAt = Some("2019-04-02"))
      )
      tl <- AssetEvents.timeline(xa, toby, id).map(_.toOption.get)
    } yield expect(tl.events.head.eventType == "serviced") and // now > the backdated 2019 acquisition
      expect(tl.events.last.eventType == "acquired") and
      expect(tl.events.exists(_.party.contains("AP Service")))
  }

  test("§11 — a logged event is audited → it shows in the asset's activity feed") { xa =>
    for {
      id <- newAsset(xa)
      _ <- AssetEvents.log(xa, lorna, id, LogReq("serviced", Some(1000L), Some("GBP"), None))
      rows <- AuditRepo.forTarget("asset", id, 50).transact(xa)
    } yield expect(rows.exists(_.action == "asset.serviced"))
  }
}
