package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Assets.CreateReq
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.s3.ObjectStore
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F45 §6.3 — the tenant no-leak bar. Two tenants, one asset each; tenant A's principal must NEVER see tenant B's row
  * on any path — not in the listing, not by direct id. This IT grows one block per swept domain and must stay green
  * forever; a new endpoint that forgets the tenant filter fails here, not in production.
  *
  * Swept so far: **Assets** (list · detail-by-id · create).
  */
object TenantNoLeakIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  // tenant A = the seeded default tenant; toby is its principal (tenantId defaults to Tenant.DefaultId)
  private val tobyA =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")

  private def newTenant(xa: Transactor[IO]): IO[UUID] =
    sql"insert into tenants (slug, name) values (${"tenant-" + UUID.randomUUID()}, 'Tenant B') returning id"
      .query[UUID]
      .unique
      .transact(xa)

  private def req(title: String, cat: UUID) =
    CreateReq(title, None, cat, None, "unique", 1, None, None, None, None, None, None)

  test("assets: tenant B's asset is invisible to tenant A — not in the list, 404 by id (and vice-versa)") { xa =>
    for {
      store <- ObjectStore.inMemory
      tenantB <- newTenant(xa)
      // a principal in tenant B (a fresh user id; role rules resolve by role, rows resolve by tenant)
      pB = Principal(UUID.randomUUID(), "b", "owner-b@kanzen.local", "principal", None, tenantB)
      cat <- AssetRepo.createCategory("TNL-cat", None).transact(xa)
      aAsset <- Assets.create(xa, tobyA, req("A-only widget", cat)).map(_.toOption.get)
      bAsset <- Assets.create(xa, pB, req("B-secret heirloom", cat)).map(_.toOption.get)

      aList <- Assets.list(xa, tobyA, store, None, None).map(_.toOption.get)
      bList <- Assets.list(xa, pB, store, None, None).map(_.toOption.get)
      aSeesBById <- Assets.detail(xa, tobyA, bAsset.id) // must be a 404, not B's row
      bSeesAById <- Assets.detail(xa, pB, aAsset.id) // symmetric
    } yield expect(aList.exists(_.id == aAsset.id)) and
      expect(!aList.exists(_.id == bAsset.id)) and // no leak via the listing
      expect(bList.exists(_.id == bAsset.id)) and
      expect(!bList.exists(_.id == aAsset.id)) and // B is its own island too
      expect(aSeesBById.left.exists(_._1.code == 404)) and // no leak by direct id
      expect(bSeesAById.left.exists(_._1.code == 404))
  }
}
