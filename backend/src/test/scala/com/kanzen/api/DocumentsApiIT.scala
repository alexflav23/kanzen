package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Documents.{LinkReq, UploadReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.s3.ObjectStore
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.{Base64, UUID}

/** F05 — documents: immutable upload + checksum (AC1), polymorphic links (AC2), Principal-private visibility (AC3),
  * presigned download (AC4), soft-delete retains the original (AC5), dedup (AC6), property scope (AC7).
  */
object DocumentsApiIT extends IOSuite {
  type Res = (Transactor[IO], ObjectStore)
  override def sharedResource =
    TestDb.transactor.flatMap(xa => cats.effect.Resource.eval(ObjectStore.inMemory).map((xa, _)))

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "toby", "flavian@kanzen.local", "principal")
  private val lorna = Principal(UUID.randomUUID(), "lorna", "lorna@kanzen.local", "manager")
  private val siti =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000004"), "siti", "siti@kanzen.local", "staff")
  private val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")

  private def b64(s: String) = Base64.getEncoder.encodeToString(s.getBytes("UTF-8"))
  private def req(name: String, content: String, visibility: String = "household", propertyId: Option[UUID] = None) =
    UploadReq(name, "receipt", "application/pdf", b64(content), Some(visibility), Some("manual"), propertyId)

  test("AC1 — upload stores an immutable, checksummed original; the S3 object is write-once") { (res) =>
    val (xa, store) = res
    Documents.upload(store, xa, lorna, req("receipt.pdf", "RECEIPT-BYTES-1")).flatMap {
      case Right(r) =>
        val expectedSha = ObjectStore.sha256Hex("RECEIPT-BYTES-1".getBytes("UTF-8"))
        // the object exists and re-putting the same key is rejected (immutability)
        val key = s"documents/${lorna.userId}/${r.document.id}/original.pdf"
        store.put(key, "application/pdf", "x".getBytes).attempt.map { reput =>
          expect(r.document.category == "receipt") and expect(r.document.source == "manual") and
            expect(r.document.immutable) and expect(r.document.sha256.contains(expectedSha)) and
            expect(reput.isLeft) // write-once
        }
      case Left((sc, _)) => IO.pure(failure(s"expected 200, got $sc"))
    }
  }

  test("AC2 — polymorphic attachment to multiple targets") { (res) =>
    val (xa, store) = res
    for {
      doc <- Documents.upload(store, xa, lorna, req("invoice.pdf", "INV-1")).map(_.toOption.get.document)
      asset = UUID.randomUUID(); txn = UUID.randomUUID()
      l1 <- Documents.addLink(xa, lorna, doc.id, LinkReq("asset", asset, Some("proof")))
      l2 <- Documents.addLink(xa, lorna, doc.id, LinkReq("bank_transaction", txn, None))
      targets <- com.kanzen.docs.DocumentRepo.targetsOf(doc.id).transact(xa)
    } yield expect(l1.isRight) and expect(l2.isRight) and
      expect(targets.contains(("asset", asset))) and expect(targets.contains(("bank_transaction", txn)))
  }

  test("AC3 — a Principal-private document is invisible to the Manager (not listed; 404 direct)") { (res) =>
    val (xa, store) = res
    for {
      priv <- Documents
        .upload(store, xa, toby, req("legal.pdf", "PRIVATE-1", visibility = "principal_private"))
        .map(_.toOption.get.document)
      mgrList <- Documents.list(xa, lorna, None, None).map(_.toOption.get)
      mgrGet <- Documents.detail(xa, lorna, priv.id)
      tobyGet <- Documents.detail(xa, toby, priv.id)
    } yield expect(!mgrList.exists(_.id == priv.id)) and
      expect(mgrGet.left.exists(_._1.code == 404)) and
      expect(tobyGet.isRight)
  }

  test("AC4 — download returns a short-lived presigned URL") { (res) =>
    val (xa, store) = res
    for {
      doc <- Documents.upload(store, xa, toby, req("warranty.pdf", "WAR-1")).map(_.toOption.get.document)
      dl <- Documents.download(store, xa, toby, doc.id)
    } yield expect(dl.toOption.exists(r => r.url.startsWith("memory://") && r.expiresInSeconds > 0))
  }

  test("AC5 — soft-delete hides metadata but the original is retained") { (res) =>
    val (xa, store) = res
    for {
      doc <- Documents.upload(store, xa, lorna, req("statement.pdf", "STMT-1")).map(_.toOption.get.document)
      key = s"documents/${lorna.userId}/${doc.id}/original.pdf"
      _ <- Documents.softDelete(xa, lorna, doc.id)
      gone <- Documents.detail(xa, lorna, doc.id)
      still <- store.exists(key)
    } yield expect(gone.left.exists(_._1.code == 404)) and expect(still) // original retained
  }

  test("AC6 — identical sha256 dedups (no second object)") { (res) =>
    val (xa, store) = res
    for {
      first <- Documents.upload(store, xa, toby, req("dup.pdf", "SAME-BYTES")).map(_.toOption.get)
      second <- Documents.upload(store, xa, toby, req("dup-again.pdf", "SAME-BYTES")).map(_.toOption.get)
    } yield expect(!first.deduped) and expect(second.deduped) and expect(second.document.id == first.document.id)
  }

  test("AC7 — property scope: a Singapore user can't see a Wardian-scoped document") { (res) =>
    val (xa, store) = res
    for {
      doc <- Documents
        .upload(store, xa, toby, req("wardian-lease.pdf", "LEASE-1", propertyId = Some(wardian)))
        .map(_.toOption.get.document)
      sitiGet <- Documents.detail(xa, siti, doc.id)
      sitiList <- Documents.list(xa, siti, None, None).map(_.toOption.get)
    } yield expect(sitiGet.left.exists(_._1.code == 404)) and expect(!sitiList.exists(_.id == doc.id))
  }

  test("staff cannot upload (403)") { (res) =>
    val (xa, store) = res
    Documents.upload(store, xa, siti, req("x.pdf", "X")).map(r => expect(r.left.exists(_._1.code == 403)))
  }
}
