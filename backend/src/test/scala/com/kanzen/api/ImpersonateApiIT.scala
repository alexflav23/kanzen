package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Impersonate.ImpersonateReq
import com.kanzen.auth.{Auth, DevAuth, Principal}
import com.kanzen.db.TestDb
import com.kanzen.identity.Principals
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F02 — the impersonation engine: an admin mints an act-as token that authenticates as the target but records the real
  * admin (`impersonatedBy`); non-admins are refused; audited.
  */
object ImpersonateApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val tobyId = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private val toby = Principal(tobyId, "t", "toby@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("an admin impersonates a user → token resolves as the target, stamped with the real admin") { xa =>
    for {
      dev <- DevAuth.generate("", "")
      res <- Impersonate.start(xa, Some(dev), toby, ImpersonateReq("marcia@kanzen.local")).map(_.toOption.get)
      // the minted token, verified + resolved, IS Marcia — but impersonatedBy points back to Toby
      auth = Auth(dev.jwks, "", "", Principals.resolver(xa))
      principal <- auth.securityLogic(res.token).map(_.toOption.get)
      // and the impersonation was audited
      audits <-
        sql"select count(*) from audit_log_entries where action = 'impersonate.start' and actor_id = $tobyId and target_id = ${principal.userId}"
          .query[Long]
          .unique
          .transact(xa)
    } yield expect(res.role == "staff") and expect(res.email == "marcia@kanzen.local") and
      expect(principal.email == "marcia@kanzen.local") and expect(principal.role == "staff") and
      expect(principal.impersonatedBy.contains(tobyId)) and // recalibrates to Marcia, knows it's Toby
      expect(audits >= 1L)
  }

  test("a non-admin cannot impersonate (403)") { xa =>
    for {
      dev <- DevAuth.generate("", "")
      res <- Impersonate.start(xa, Some(dev), marcia, ImpersonateReq("toby@kanzen.local"))
    } yield expect(res.left.exists(_._1.code == 403))
  }

  test("impersonating an unknown user is 404") { xa =>
    for {
      dev <- DevAuth.generate("", "")
      res <- Impersonate.start(xa, Some(dev), toby, ImpersonateReq("ghost@kanzen.local"))
    } yield expect(res.left.exists(_._1.code == 404))
  }

  test("impersonation is unavailable without the dev mint (501)") { xa =>
    Impersonate
      .start(xa, None, toby, ImpersonateReq("marcia@kanzen.local"))
      .map(r => expect(r.left.exists(_._1.code == 501)))
  }
}
