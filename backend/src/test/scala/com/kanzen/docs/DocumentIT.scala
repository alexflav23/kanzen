package com.kanzen.docs

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
    val prog = for {
      doc <- DocumentRepo.create("receipt_001.pdf", "receipt", Some("documents/x/original.pdf"), Some("abc123"), "household")
      _ <- DocumentRepo.link(doc.id, "asset", assetId, Some("proof"))
      links <- DocumentRepo.linksFor("asset", assetId)
    } yield (doc, links)
    prog.transact(xa).map { case (doc, links) =>
      expect(doc.immutable) and expect(links.contains(doc.id))
    }
  }
}
