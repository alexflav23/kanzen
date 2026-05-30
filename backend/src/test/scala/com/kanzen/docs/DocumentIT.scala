package com.kanzen.docs

import com.kanzen.tenant.Tenant
import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F05 integration test: immutable document + polymorphic attach to an asset. */
object DocumentIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("a receipt document is immutable and links to an asset") { xa =>
    val assetId = UUID.randomUUID()
    val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")
    val prog = for {
      doc <- DocumentRepo.insert(
        UUID.randomUUID(),
        owner,
        Tenant.DefaultId,
        "receipt_001.pdf",
        "receipt",
        Some("application/pdf"),
        Some(1234L),
        "documents/x/original.pdf",
        "abc123",
        "household",
        "manual",
        None
      )
      _ <- DocumentRepo.link(doc.id, "asset", assetId, Some("proof"))
      links <- DocumentRepo.linksFor("asset", assetId)
    } yield (doc, links)
    prog.transact(xa).map { case (doc, links) =>
      expect(doc.immutable) and expect(links.contains(doc.id))
    }
  }
}
