package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** Phase 1 — `GET /api/properties` handler against a Flyway-migrated Postgres, including the V2_21 household seed +
  * V2_22 property permission rules. Proves authorize → query end-to-end and the default-deny path.
  */
object PropertiesApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def principal(role: String) =
    Principal(userId = java.util.UUID.randomUUID(), subject = s"sub-$role", email = s"$role@kanzen.local", role = role)

  test("principal sees the two seeded properties") { xa =>
    Properties.list(xa, principal("principal")).map {
      case Right(ps) =>
        expect(ps.exists(_.name == "Wardian — Apt 5206")) and
          expect(ps.exists(p => p.name == "Singapore Residence" && p.currency == "SGD"))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("a property-scoped user sees only their property (F02 scope)") { xa =>
    // Siti (seeded) is scoped to the Singapore residence only.
    val siti = Principal(
      java.util.UUID.fromString("10000000-0000-0000-0000-000000000004"),
      "siti-sub",
      "siti@kanzen.local",
      "staff"
    )
    Properties.list(xa, siti).map {
      case Right(ps) =>
        expect(ps.size == 1) and
          expect(ps.exists(_.name == "Singapore Residence")) and
          expect(!ps.exists(_.name.startsWith("Wardian")))
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("manager and staff can read properties (operational)") { xa =>
    for {
      m <- Properties.list(xa, principal("manager"))
      s <- Properties.list(xa, principal("staff"))
    } yield expect(m.isRight) and expect(s.isRight) and
      expect(m.toOption.exists(_.nonEmpty)) and expect(s.toOption.exists(_.nonEmpty))
  }

  test("an unknown role is denied (default-deny → 403)") { xa =>
    Properties.list(xa, principal("guest")).map {
      case Left((sc, err)) => expect(sc.code == 403) and expect(err.code == "forbidden")
      case Right(_) => failure("expected 403 for a role with no property rule")
    }
  }

  private val wardianId = java.util.UUID.fromString("20000000-0000-0000-0000-000000000001")
  private val singaporeId = java.util.UUID.fromString("20000000-0000-0000-0000-000000000002")
  private def siti = Principal(
    java.util.UUID.fromString("10000000-0000-0000-0000-000000000004"),
    "siti-sub",
    "siti@kanzen.local",
    "staff"
  )

  test("detail: principal reads the Wardian Bible aggregate (real rooms/assets/bills/vendors counts)") { xa =>
    Properties.detail(xa, principal("principal"), wardianId).map {
      // V2_63 seeds Wardian's 9 rooms; V2_76 places 5 household items into them (so the Bible's Assets tab +
      // the aggregate have a body); the seed gives Wardian 2 bills + 2 vendor links.
      case Right(d) =>
        expect(d.name == "Wardian — Apt 5206") and expect(d.rooms == 9) and expect(d.assets == 5) and
          expect(d.bills == 2) and expect(d.vendors == 2)
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("detail: a scoped user gets 404 (not 403) for an out-of-scope property — no leak (AC4)") { xa =>
    Properties.detail(xa, siti, wardianId).map {
      case Left((sc, err)) => expect(sc.code == 404) and expect(err.code == "not_found")
      case Right(_) => failure("Siti must not see Wardian's existence")
    }
  }

  test("detail: the scoped user can read their in-scope property") { xa =>
    Properties.detail(xa, siti, singaporeId).map {
      case Right(d) => expect(d.name == "Singapore Residence")
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("detail: a role with no property read is forbidden (403)") { xa =>
    Properties.detail(xa, principal("guest"), wardianId).map {
      case Left((sc, err)) => expect(sc.code == 403) and expect(err.code == "forbidden")
      case Right(_) => failure("expected 403")
    }
  }
}
