package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F10 — people/HR: manager roster (AC6), staff own-only + 403 for others (AC3), permit-expiry surfacing (AC1). Records
  * are seeded (V2_28) linked to user accounts.
  */
object PeopleApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")
  private val siti =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "s", "siti@kanzen.local", "staff")
  private val sitiRecord = UUID.fromString("50000000-0000-0000-0000-000000000004")

  test("AC6 — Manager sees the full roster") { xa =>
    People.list(xa, lorna).map {
      case Right(rows) =>
        expect(rows.exists(_.name == "Marcia")) and expect(rows.exists(_.name == "Siti")) and expect(rows.size >= 3)
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("AC3 — Staff sees only their own record") { xa =>
    People.list(xa, marcia).map {
      case Right(rows) => expect(rows.size == 1) and expect(rows.exists(_.name == "Marcia"))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("AC3 — Staff fetching another staff record is denied (403)") { xa =>
    People.detail(xa, marcia, sitiRecord).map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("Staff can fetch their own record by id") { xa =>
    for {
      own <- People.list(xa, siti).map(_.toOption.get.head)
      self <- People.detail(xa, siti, own.id)
    } yield expect(self.toOption.exists(_.name == "Siti"))
  }

  test("W7.1 — the detail view carries the rich HR fields (contract, permit no, emergency contacts)") { xa =>
    People.detail(xa, lorna, sitiRecord).map {
      case Right(v) =>
        expect(v.contractType.contains("Full-time")) and
          expect(v.workPermitNo.contains("S1234567X")) and
          expect(v.payrollRef.isDefined) and
          expect(v.startDate.isDefined) and
          expect(v.emergencyContacts.exists(_.name == "Ahmad Rahmat"))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("AC1 — Siti's expiring permit surfaces to the Manager") { xa =>
    People.expiring(xa, lorna, 60).map {
      case Right(rows) => expect(rows.exists(p => p.name == "Siti" && p.permitExpiry.isDefined))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("only a Manager+ can create a person (staff 403)") { xa =>
    for {
      ok <- People.create(xa, lorna, People.CreateReq("New Hire", Some("Gardener"), Some("uk"), None, None, None, None))
      denied <- People.create(xa, marcia, People.CreateReq("Nope", None, None, None, None, None, None))
    } yield expect(ok.isRight) and expect(denied.left.exists(_._1.code == 403))
  }
  test("F34 — person create emits person.created") { xa =>
    import doobie.implicits._
    import doobie.postgres.implicits._
    for {
      per <- People
        .create(xa, lorna, People.CreateReq("F34 Hire", Some("Gardener"), Some("uk"), None, None, None, None))
        .map(_.toOption.get)
      events <-
        sql"select event_type from event_outbox where aggregate_id = ${per.id}".query[String].to[List].transact(xa)
    } yield expect(events.contains("person.created"))
  }
}
