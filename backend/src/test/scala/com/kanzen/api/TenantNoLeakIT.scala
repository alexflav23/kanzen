package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Assets.CreateReq
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.calendar.CalendarRepo
import com.kanzen.finance.{BillRepo, ExpenseRepo}
import com.kanzen.property.PropertyRepo
import com.kanzen.tasks.TaskRepo

import java.time.LocalDate
import com.kanzen.db.TestDb
import com.kanzen.s3.ObjectStore
import com.kanzen.tenant.Tenant
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

  test("tasks: a task created in tenant B never appears in tenant A's task list (and vice-versa)") { xa =>
    for {
      tenantB <- newTenant(xa)
      aTask <- TaskRepo.createUnfiled(Tenant.DefaultId, "A-only task", None, "normal", None).transact(xa)
      bTask <- TaskRepo.createUnfiled(tenantB, "B-only task", None, "normal", None).transact(xa)
      aList <- TaskRepo.listTasks(Tenant.DefaultId, None).transact(xa)
      bList <- TaskRepo.listTasks(tenantB, None).transact(xa)
      // by-id read is tenant-scoped too
      aSeesB <- TaskRepo.get(bTask.id, Tenant.DefaultId).transact(xa)
      bSeesA <- TaskRepo.get(aTask.id, tenantB).transact(xa)
    } yield expect(aList.exists(_.id == aTask.id)) and
      expect(!aList.exists(_.id == bTask.id)) and
      expect(bList.exists(_.id == bTask.id)) and
      expect(!bList.exists(_.id == aTask.id)) and
      expect(aSeesB.isEmpty) and // B's task is not fetchable as tenant A
      expect(bSeesA.isEmpty)
  }

  test("finance: bills + expenses are tenant-isolated (no leak via the list nor by id nor totals)") { xa =>
    for {
      tenantB <- newTenant(xa)
      ownerB = UUID.randomUUID()
      aBill <- BillRepo.create(Tenant.DefaultId, "A Water", None, None, 5000L, "GBP", Some("monthly")).transact(xa)
      bBill <- BillRepo.create(tenantB, "B Power", None, None, 9000L, "GBP", Some("monthly")).transact(xa)
      aExp <- ExpenseRepo
        .submit(
          UUID.randomUUID(),
          Tenant.DefaultId,
          Some("A vendor"),
          None,
          1000L,
          "GBP",
          None,
          None,
          false,
          false,
          None,
          UUID.randomUUID()
        )
        .transact(xa)
      bExp <- ExpenseRepo
        .submit(ownerB, tenantB, Some("B vendor"), None, 2000L, "GBP", None, None, true, false, None, ownerB)
        .transact(xa)
      aBills <- BillRepo.list(Tenant.DefaultId).transact(xa)
      bBills <- BillRepo.list(tenantB).transact(xa)
      aExps <- ExpenseRepo.list(Tenant.DefaultId, None).transact(xa)
      bExps <- ExpenseRepo.list(tenantB, None).transact(xa)
      aBSeesBill <- BillRepo.get(bBill.id, Tenant.DefaultId).transact(xa)
      aBSeesExp <- ExpenseRepo.get(bExp.id, Tenant.DefaultId).transact(xa)
    } yield expect(aBills.exists(_.id == aBill.id)) and expect(!aBills.exists(_.id == bBill.id)) and
      expect(bBills.exists(_.id == bBill.id)) and expect(!bBills.exists(_.id == aBill.id)) and
      expect(aExps.exists(_.id == aExp.id)) and expect(!aExps.exists(_.id == bExp.id)) and
      expect(bExps.exists(_.id == bExp.id)) and expect(!bExps.exists(_.id == aExp.id)) and
      expect(aBSeesBill.isEmpty) and expect(aBSeesExp.isEmpty) // no leak by direct id across tenants
  }

  test("calendar: a tenant only sees its own events in the merged window") { xa =>
    val day = LocalDate.of(2026, 7, 15)
    for {
      tenantB <- newTenant(xa)
      aEv <- CalendarRepo
        .createNative(UUID.randomUUID(), Tenant.DefaultId, "A dentist", day, "manual", None, "manual", None)
        .transact(xa)
      bEv <- CalendarRepo
        .createNative(UUID.randomUUID(), tenantB, "B board meeting", day, "manual", None, "manual", None)
        .transact(xa)
      aMerged <- CalendarRepo.merged(Tenant.DefaultId, day, day).transact(xa)
      bMerged <- CalendarRepo.merged(tenantB, day, day).transact(xa)
    } yield expect(aMerged.exists(_.id == aEv)) and expect(!aMerged.exists(_.id == bEv)) and
      expect(bMerged.exists(_.id == bEv)) and expect(!bMerged.exists(_.id == aEv))
  }

  test("properties: a tenant's principal only sees its own properties (the scoping primitive is tenant-bounded)") {
    xa =>
      for {
        tenantB <- newTenant(xa)
        ownerB = UUID.randomUUID()
        bProp <- PropertyRepo
          .insert(ownerB, tenantB, "B Villa", None, Some("sg"), Some("house"), Some("owned"), "SGD")
          .transact(xa)
        // tenant A's principal (no scope rows → "sees all" branch) must still be tenant-bounded
        aVisible <- PropertyRepo.listForPrincipal(Tenant.DefaultId, tobyA.userId).transact(xa)
        bVisible <- PropertyRepo.listForPrincipal(tenantB, ownerB).transact(xa)
        aSeesBById <- PropertyRepo.findProperty(bProp.id, Tenant.DefaultId).transact(xa)
      } yield expect(!aVisible.exists(_.id == bProp.id)) and // B's property never leaks into A's "see all"
        expect(bVisible.exists(_.id == bProp.id)) and
        expect(aVisible.nonEmpty) and // A still sees its own seeded properties
        expect(aSeesBById.isEmpty) // nor by direct id
  }
}
