package com.kanzen.ext

import cats.effect.IO
import com.kanzen.db.TestDb
import doobie.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F33 integration test: a user-defined infinite taxonomy + polymorphic tagging. */
object ExtensibilityIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  test("build a nested 'Cleaning products' taxonomy and tag an arbitrary entity") { xa =>
    val vendorId = UUID.randomUUID()
    val prog = for {
      tax <- TaxonomyRepo.create("Cleaning products", "product")
      groceries <- TaxonomyRepo.addNode(tax, None, "Groceries")
      _ <- TaxonomyRepo.addNode(tax, Some(groceries), "Eggs")
      nodes <- TaxonomyRepo.nodes(tax)
      fragile <- TagRepo.createTag("fragile", Some("fragile"))
      _ <- TagRepo.tagEntity(fragile, "vendor", vendorId)
      tags <- TagRepo.tagsFor("vendor", vendorId)
    } yield (nodes, tags)

    prog.transact(xa).map { case (nodes, tags) =>
      expect(nodes.size == 2) and
        expect(nodes.exists { case (_, parent, name) => name == "Eggs" && parent.isDefined }) and
        expect(tags.contains("fragile"))
    }
  }
}
