package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F09 — vendors: selectability by insurance (AC1), property scope (AC4), create + approve (AC5), staff-denied writes
  * (AC6). Seeded directory (V2_29).
  */
object VendorsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")
  private val siti =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "s", "siti@kanzen.local", "staff")
  private val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")

  test("AC4 — property scope: Wardian Staff see only Wardian vendors; Singapore Staff see Singapore's") { xa =>
    for {
      m <- Vendors.list(xa, marcia).map(_.toOption.get)
      s <- Vendors.list(xa, siti).map(_.toOption.get)
    } yield expect(m.exists(_.name == "Thames Plumbing")) and expect(m.exists(_.name == "Volt Electrics")) and
      expect(!m.exists(_.name == "Marina Aircon")) and // Singapore-only, hidden from Marcia
      expect(s.exists(_.name == "Marina Aircon")) and expect(!s.exists(_.name == "Thames Plumbing"))
  }

  test("AC1 — only approved + insured vendors are selectable (expired insurance blocked)") { xa =>
    Vendors.selectable(xa, lorna, wardian).map {
      case Right(vs) =>
        expect(vs.exists(_.name == "Thames Plumbing")) and expect(!vs.exists(_.name == "Volt Electrics")) // expired
      case Left((sc, _)) => failure(s"expected 200, got $sc")
    }
  }

  test("AC5 — Manager creates a vendor and approves it for a property") { xa =>
    for {
      created <- Vendors
        .create(xa, lorna, Vendors.CreateReq("New Plumber", Some("business"), Some("plumber"), None, None, None))
        .map(_.toOption.get)
      approved <- Vendors.approve(xa, lorna, created.id, wardian)
      detail <- Vendors.detail(xa, lorna, created.id).map(_.toOption.get)
    } yield expect(approved.isRight) and expect(detail.approvedProperties.contains(wardian))
  }

  test("AC6 — Staff cannot create vendors (403)") { xa =>
    Vendors
      .create(xa, marcia, Vendors.CreateReq("Nope", None, None, None, None, None))
      .map(r => expect(r.left.exists(_._1.code == 403)))
  }

  test("Manager sees the full directory across properties") { xa =>
    Vendors
      .list(xa, lorna)
      .map(_.toOption.exists(vs => vs.exists(_.name == "Thames Plumbing") && vs.exists(_.name == "Marina Aircon")))
      .map(expect(_))
  }
}
