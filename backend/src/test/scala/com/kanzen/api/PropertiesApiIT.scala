package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

/** Phase 1 — `GET /api/properties` handler against a Flyway-migrated Postgres, including
  * the V2_21 household seed + V2_22 property permission rules. Proves authorize → query
  * end-to-end and the default-deny path. */
object PropertiesApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def principal(role: String) = Principal(subject = s"sub-$role", email = s"$role@kanzen.local", role = role)

  test("principal sees the two seeded properties") { xa =>
    Properties.list(xa, principal("principal")).map {
      case Right(ps) =>
        expect(ps.exists(_.name == "Wardian — Apt 5206")) and
          expect(ps.exists(p => p.name == "Singapore Residence" && p.currency == "SGD"))
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
      case Right(_)        => failure("expected 403 for a role with no property rule")
    }
  }
}
