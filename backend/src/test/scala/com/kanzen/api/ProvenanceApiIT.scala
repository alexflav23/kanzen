package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Provenance.{AddPartyReq, AddWarrantyReq, SetInsuranceReq}
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F21 — warranties (Manager+ write) + insurance (Principal-only; Manager denied). */
object ProvenanceApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")
  private val marcia = Principal(UUID.randomUUID(), "m", "marcia@kanzen.local", "staff")

  private def newAsset(xa: Transactor[IO]): IO[UUID] =
    (for {
      cat <- AssetRepo.createCategory("Watches", None)
      a <- AssetRepo.create("Royal Oak", Some("AP"), cat, "unique", 1, Json.obj())
    } yield a.id).transact(xa)

  test("Manager can add + list warranties (registry)") { xa =>
    for {
      id <- newAsset(xa)
      add <- Provenance.addWarranty(
        xa,
        lorna,
        id,
        AddWarrantyReq(Some("Audemars Piguet"), None, Some(LocalDate.now.plusYears(2)))
      )
      ws <- Provenance.warranties(xa, lorna, id).map(_.toOption.get)
    } yield expect(add.isRight) and expect(ws.exists(_.provider.contains("Audemars Piguet")))
  }

  test("Staff cannot add a warranty nor see warranties (registry, 403)") { xa =>
    for {
      id <- newAsset(xa)
      add <- Provenance.addWarranty(xa, marcia, id, AddWarrantyReq(None, None, None))
      ws <- Provenance.warranties(xa, marcia, id)
    } yield expect(add.left.exists(_._1.code == 403)) and expect(ws.left.exists(_._1.code == 403))
  }

  test("insurance is Principal-only: Principal sets + reads; Manager is denied (403)") { xa =>
    for {
      id <- newAsset(xa)
      set <- Provenance.setInsurance(
        xa,
        toby,
        id,
        SetInsuranceReq(
          insured = true,
          Some("Hiscox-2026"),
          Some("Hiscox"),
          Some(4_200_000L),
          Some(LocalDate.now.plusMonths(11))
        )
      )
      pGet <- Provenance.getInsurance(xa, toby, id).map(_.toOption.get)
      mSet <- Provenance.setInsurance(xa, lorna, id, SetInsuranceReq(insured = true, None, None, Some(1L), None))
      mGet <- Provenance.getInsurance(xa, lorna, id)
    } yield expect(set.isRight) and
      expect(pGet.insured && pGet.insuredValueMinor.contains(4_200_000L) && pGet.policyRef.contains("Hiscox-2026")) and
      expect(mSet.left.exists(_._1.code == 403)) and // Manager cannot set insurance
      expect(mGet.left.exists(_._1.code == 403)) // nor read it (Principal-private)
  }

  // F21 — provenance party-roles
  test("Manager adds + lists provenance parties; bad role rejected; Staff denied") { xa =>
    for {
      id <- newAsset(xa)
      add <- Provenance.addParty(xa, lorna, id, AddPartyReq("maker", "Audemars Piguet", Some("Le Brassus")))
      add2 <- Provenance.addParty(xa, lorna, id, AddPartyReq("appraiser", "Watchfinder", None))
      ps <- Provenance.parties(xa, toby, id).map(_.toOption.get)
      badRole <- Provenance.addParty(xa, lorna, id, AddPartyReq("wizard", "X", None))
      staffAdd <- Provenance.addParty(xa, marcia, id, AddPartyReq("maker", "Y", None))
      staffList <- Provenance.parties(xa, marcia, id)
      del <- Provenance.deleteParty(xa, lorna, id, add.toOption.get.id)
      after <- Provenance.parties(xa, toby, id).map(_.toOption.get)
    } yield expect(add.isRight) and expect(add2.isRight) and
      expect(ps.exists(p => p.role == "maker" && p.name == "Audemars Piguet")) and
      expect(badRole.left.exists(_._1.code == 400)) and // role must be a known provenance role
      expect(staffAdd.left.exists(_._1.code == 403)) and expect(staffList.left.exists(_._1.code == 403)) and
      expect(del.isRight) and expect(!after.exists(_.role == "maker")) // the maker party was removed
  }
}
