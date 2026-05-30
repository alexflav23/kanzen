package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Tenants.{CreateTenantReq, PrincipalReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.s3.ObjectStore
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F46 §3.1 — public tenant signup. Creating a tenant yields an isolated household: its principal sees an empty
  * registry (its own tenant), never the seeded default tenant's data — the F45 no-leak property, end-to-end from
  * signup.
  */
object TenantsApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def uniqueSlug = "acme-" + UUID.randomUUID().toString.take(8)

  test("signup creates a tenant + principal, seeds onboarding at verify_email, and is fully isolated") { xa =>
    val slug = uniqueSlug
    for {
      store <- ObjectStore.inMemory
      resp <- Tenants
        .create(
          xa,
          CreateTenantReq("The Acme Household", slug, PrincipalReq("Ada", s"ada-${UUID.randomUUID()}@acme.test"))
        )
        .map(_.toOption.get)
      // the new principal, scoped to the brand-new tenant
      pNew = Principal(resp.principalUserId, "ada", "ada@acme.test", "principal", None, resp.tenantId)
      // their registry is empty — the seeded default tenant's 6 assets must NOT bleed in
      assets <- Assets.list(xa, pNew, store, None, None).map(_.toOption.get)
      // a seeded default-tenant principal still sees the seeded registry (no regression)
      tobyDefault = Principal(
        UUID.fromString("10000000-0000-0000-0000-000000000001"),
        "t",
        "flavian@kanzen.local",
        "principal"
      )
      tobyAssets <- Assets.list(xa, tobyDefault, store, None, None).map(_.toOption.get)
      // duplicate slug is rejected
      dup <- Tenants.create(xa, CreateTenantReq("Dup", slug, PrincipalReq("X", s"x-${UUID.randomUUID()}@acme.test")))
      badSlug <- Tenants.create(xa, CreateTenantReq("Bad", "No Spaces!", PrincipalReq("Y", "y@acme.test")))
    } yield expect(resp.currentStep == "verify_email") and
      expect(assets.isEmpty) and // a fresh tenant is a clean household
      expect(tobyAssets.nonEmpty) and // the default tenant is unaffected
      expect(dup.left.exists(_._1.code == 409)) and // slug uniqueness
      expect(badSlug.left.exists(_._1.code == 400)) // slug format
  }
}
