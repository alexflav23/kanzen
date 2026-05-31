package com.kanzen.authz

import cats.effect.IO
import com.kanzen.api.{Backup, DataQuality, Investments, NlQuery, Wealth}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** Hardening — cross-cutting authorization sweep. Proves (a) the policy engine is default-deny and the documented
  * allow/deny matrix holds across roles + sensitive fields, and (b) the endpoint wiring actually enforces it: a
  * non-Principal hitting a Principal-private surface gets a hard 403 (no leak via totals). This is the regression guard
  * for the F02 invariant.
  */
object AuthzFuzzIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  test("policy engine is default-deny and honours the documented role × resource/field matrix") { xa =>
    for {
      pa <- Authz.authorizer("principal").transact(xa)
      ma <- Authz.authorizer("manager").transact(xa)
      sa <- Authz.authorizer("staff").transact(xa)
    } yield
    // default-deny: an unknown resource is denied for non-wildcard roles (Principal holds
    // the documented `*` Admin wildcard, so it is allowed by design — not default-deny)
    expect(pa.canRead("totally_unknown_resource")) and
      expect(!ma.canRead("totally_unknown_resource")) and
      expect(!sa.canRead("totally_unknown_resource")) and
      // Private Wealth + backup are Principal-only
      expect(pa.can(Level.Admin, "wealth")) and expect(!ma.can(Level.Write, "wealth")) and expect(
        !sa.can(Level.Write, "wealth")
      ) and
      expect(pa.can(Level.Admin, "backup")) and expect(!ma.can(Level.Write, "backup")) and expect(
        !sa.can(Level.Read, "backup")
      ) and
      // registry is Principal-private with a Manager read carve-out; Staff none
      expect(pa.canRead("asset")) and expect(ma.canRead("asset")) and expect(!sa.canRead("asset")) and
      // field-level: valuation fields are stripped for Manager, visible to Principal
      expect(pa.canRead("asset", Some("market_value"))) and
      expect(!ma.canRead("asset", Some("market_value"))) and
      expect(!ma.canRead("asset", Some("insured_value"))) and
      // data quality: Manager reads (operational), Staff none
      expect(ma.canRead("data_quality")) and expect(!sa.canRead("data_quality")) and
      // operational resources Staff legitimately holds (proving it's not blanket-deny)
      expect(sa.canRead("product")) and expect(sa.canRead("calendar")) and expect(sa.canRead("search"))
  }

  test("endpoint wiring enforces it: non-Principal hits Principal-private surfaces → 403") { xa =>
    for {
      assetId <-
        sql"insert into assets (tenant_id, owner_id, title) values ('7e000000-0000-0000-0000-000000000001'::uuid, ${toby.userId}, 'authz probe') returning id"
          .query[UUID]
          .unique
          .transact(xa)
      // Private Wealth (F39–F43) + investments (F40) + backup (F30) — Principal-only
      wEnt <- Wealth.entities(xa, lorna)
      wNet <- Wealth.netWorth(xa, marcia, None)
      inv <- Investments.securities(xa, lorna)
      bkp <- Backup.export(xa, lorna)
      // NL registry query (F32) — gated on asset read → Staff 403
      nlq <- NlQuery.query(xa, marcia, "how many assets")
      // data-quality completeness (F23) — Staff none on the registry
      dq <- DataQuality.completeness(xa, marcia, assetId)
    } yield expect(wEnt.left.exists(_._1.code == 403)) and
      expect(wNet.left.exists(_._1.code == 403)) and
      expect(inv.left.exists(_._1.code == 403)) and
      expect(bkp.left.exists(_._1.code == 403)) and
      expect(nlq.left.exists(_._1.code == 403)) and
      expect(dq.left.exists(_._1.code == 403))
  }
}
