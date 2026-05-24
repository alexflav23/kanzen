package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.AssetEvents.LogReq
import com.kanzen.asset.AssetRepo
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
}
