package com.kanzen.calendar

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate

/** F07 integration test: re-syncing the same Google event updates in place (no duplicate). */
object CalendarIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("upserting the same google_event_id twice keeps one row") { xa =>
    val prog = for {
      _ <- CalendarRepo.upsert("g1", "Waitrose delivery", LocalDate.now, "agent")
      _ <- CalendarRepo.upsert("g1", "Waitrose delivery (11:00-12:00)", LocalDate.now, "agent")
      _ <- CalendarRepo.upsert("g2", "HVAC service", LocalDate.now.plusDays(5), "maintenance")
      all <- CalendarRepo.list
    } yield all
    prog.transact(xa).map { all =>
      // scope to this test's google events — `list` also returns seeded native events (V2_53)
      val mine = all.filter { case (gid, _) => gid == "g1" || gid == "g2" }
      expect(mine.size == 2) and expect(mine.exists(_._2.contains("11:00")))
    }
  }
}
