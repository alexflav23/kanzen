package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Products.{CreateReq, ForecastReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F35 products/stock + F36 replenishment forecast. */
object ProductsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna  = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("seeded products list; reorder shows low/out items") { xa =>
    for {
      all     <- Products.list(xa, marcia).map(_.toOption.get) // staff read
      reorder <- Products.reorder(xa, lorna).map(_.toOption.get)
    } yield expect(all.exists(_.name == "Nespresso pods")) and
      expect(reorder.exists(_.name == "Olive oil")) and        // 'out'
      expect(!reorder.exists(_.name == "Dishwasher tablets"))  // 'in_stock'
  }

  test("setting stock to 'out' makes a product appear in the reorder list") { xa =>
    for {
      prod    <- Products.create(xa, lorna, CreateReq("Hand soap", Some("Aesop"), Some("bottle"))).map(_.toOption.get)
      _       <- Products.setStock(xa, lorna, prod.id, "out")
      reorder <- Products.reorder(xa, lorna).map(_.toOption.get)
    } yield expect(reorder.exists(_.id == prod.id))
  }

  test("F36 — forecast predicts the next purchase from history") { xa =>
    val dates = List(LocalDate.now.minusDays(60), LocalDate.now.minusDays(40), LocalDate.now.minusDays(20)).map(_.toString)
    Products.forecast(xa, lorna, ForecastReq(dates, Some(30))).map {
      case Right(f) => expect(f.avgIntervalDays.contains(20.0)) and expect(f.predictedNext.isDefined) and expect(f.dueSoon) // ~20d cadence, next within 30d
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("Staff cannot create or set stock (403); invalid stock → 400") { xa =>
    for {
      denied <- Products.create(xa, marcia, CreateReq("X", None, None))
      bad    <- Products.setStock(xa, lorna, UUID.fromString("e0000000-0000-0000-0000-000000000001"), "banana")
    } yield expect(denied.left.exists(_._1.code == 403)) and expect(bad.left.exists(_._1.code == 400))
  }
}
