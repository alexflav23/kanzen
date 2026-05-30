package com.kanzen.api

import com.kanzen.tenant.Tenant
import cats.effect.IO
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.docs.DocumentRepo
import com.kanzen.s3.ObjectStore
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F04 — Inventory facets: the `tag` filter returns only assets carrying that tag, and an asset with a hero document
  * surfaces a signed `heroUrl` for its grid-card thumbnail (here the in-memory store's `memory://` capability URL).
  */
object InventoryFacetIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private def sfx = UUID.randomUUID().toString.take(8)
  private def principal = Principal(UUID.randomUUID(), "p", "p@k.local", "principal")

  test("tag facet returns only the tagged asset; a hero document yields a heroUrl") { xa =>
    val s = sfx; val owner = UUID.randomUUID(); val docId = UUID.randomUUID()
    val prog = for {
      store <- ObjectStore.inMemory
      cat <- sql"select id from categories limit 1".query[UUID].unique.transact(xa)
      asset <- AssetRepo
        .insert(
          owner,
          Tenant.DefaultId,
          s"Tagged $s",
          None,
          cat,
          None,
          "unique",
          1,
          None,
          None,
          None,
          None,
          None,
          Json.obj()
        )
        .transact(xa)
      _ <- DocumentRepo
        .insert(
          docId,
          owner,
          Tenant.DefaultId,
          s"hero-$s.jpg",
          "photo",
          Some("image/jpeg"),
          Some(123L),
          s"documents/$owner/$docId/original.jpg",
          s"sha$s",
          "household",
          "manual",
          None
        )
        .transact(xa)
      _ <- AssetRepo.setHero(asset.id, docId).transact(xa)
      tagId <- sql"insert into tags (name, slug) values (${"t-" + s}, ${"t-" + s}) returning id"
        .query[UUID]
        .unique
        .transact(xa)
      _ <-
        sql"insert into entity_tags (tag_id, entity_type, entity_id) values ($tagId, 'asset', ${asset.id})".update.run
          .transact(xa)
      p = principal
      tagged <- Assets.list(xa, p, store, None, None, tag = Some(tagId))
      all <- Assets.list(xa, p, store, None, None)
    } yield (asset.id, tagged, all)
    prog.map { case (aid, tagged, all) =>
      val taggedIds = tagged.toOption.toList.flatten.map(_.id).toSet
      val mine = all.toOption.toList.flatten.find(_.id == aid)
      expect(taggedIds == Set(aid)) and // the facet returns exactly the tagged asset
        expect(mine.exists(_.heroUrl.exists(_.startsWith("memory://")))) // its hero photo resolves to a blob URL
    }
  }
}
