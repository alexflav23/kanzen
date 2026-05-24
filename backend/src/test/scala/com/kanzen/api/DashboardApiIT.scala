package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F29 — the dashboard summary, authz/scope-filtered: Principal sees the seeded approvals/properties/assets/permits;
  * Staff's registry/finance counts are zero.
  */
object DashboardApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "toby@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("Principal summary reflects the seeded data") { xa =>
    Dashboard.summary(xa, toby).map {
      case Right(s) =>
        expect(s.pendingApprovals >= 2) and // 2 seeded pending expenses
          expect(s.properties >= 2) and // Wardian + Singapore
          expect(s.assets >= 5) and // seeded registry
          expect(s.expiringPermits >= 1) // Siti's permit
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("Staff see zero registry/finance counts (no leak) but their scoped properties") { xa =>
    Dashboard.summary(xa, marcia).map {
      case Right(s) =>
        expect(s.assets == 0) and // no registry read
          expect(s.pendingApprovals == 0) and // no finance read
          expect(s.expiringPermits == 0) and // people gated for staff
          expect(s.properties >= 1) // Marcia is scoped to Wardian
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }
}
