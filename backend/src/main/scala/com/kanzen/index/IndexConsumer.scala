package com.kanzen.index

import cats.effect.{IO, Temporal}
import cats.syntax.all._
import com.kanzen.events.{Consumer, EventRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor

import java.util.UUID
import scala.concurrent.duration._

/** F32 / NL-2 — the RAG indexer. Two freshness paths: (1) this F34 Consumer re-indexes on any event whose subject is an
  * indexable entity (immediate, for entity types that emit events); (2) the [[IndexReconcile]] loop re-renders on a
  * cadence (the complete safety net — assets currently write via the audit trail, not F34, so the reconcile is their
  * path). Idempotent upsert, so redelivery / overlap is harmless.
  */
object IndexConsumer extends Consumer {
  val name = "EntityIndexer"

  def handle(evt: EventRepo.OutboxRow): ConnectionIO[Unit] = {
    val c = evt.payload.hcursor
    val subjType = c.downField("subject").get[String]("type").toOption
    val subjId = c.downField("subject").get[UUID]("id").toOption
    (subjType, subjId) match {
      case (Some("asset"), Some(id)) => index(AssetDocRenderer.render(id))
      case (Some("person"), Some(id)) => index(PersonDocRenderer.render(id))
      case (Some("property"), Some(id)) => index(PropertyDocRenderer.render(id))
      case (Some("document"), Some(id)) => index(DocumentDocRenderer.render(id))
      case _ => ().pure[ConnectionIO] // expense/finance retrieval lands later (Principal-private, ledger-hidden)
    }
  }

  /** Render → upsert (idempotent); a renderer returning None (deleted/missing) is a no-op. */
  def index(rendered: ConnectionIO[Option[RenderedDoc]]): ConnectionIO[Unit] =
    rendered.flatMap {
      case Some(doc) => EntityDocRepo.upsert(doc).void
      case None => ().pure[ConnectionIO]
    }

  def indexAsset(id: UUID): ConnectionIO[Unit] = index(AssetDocRenderer.render(id))
}

/** F32 / NL-2 — keep the RAG index complete. `run` re-renders + upserts every indexable entity (idempotent); the first
  * pass at boot is the backfill, and the `loop` keeps it fresh thereafter — so every new asset and every update lands
  * in the index within one cycle, regardless of whether the write emitted an F34 event. (At scale this becomes an
  * `updated_at`-delta pass; full re-render is ample at household scale and guarantees completeness.)
  */
object IndexReconcile {
  // each indexable group: its id source + its renderer. Add a group here and the reconcile pass picks it up.
  private val groups: List[(ConnectionIO[List[UUID]], UUID => ConnectionIO[Option[RenderedDoc]])] = List(
    (AssetDocRenderer.allIds, AssetDocRenderer.render),
    (PersonDocRenderer.allIds, PersonDocRenderer.render),
    (PropertyDocRenderer.allIds, PropertyDocRenderer.render),
    (DocumentDocRenderer.allIds, DocumentDocRenderer.render)
  )

  def run(xa: Transactor[IO]): IO[Int] =
    groups
      .flatTraverse { case (ids, render) =>
        for {
          xs <- ids
          _ <- xs.traverse_(id => IndexConsumer.index(render(id)))
        } yield xs
      }
      .map(_.size)
      .transact(xa)

  def loop(xa: Transactor[IO], every: FiniteDuration = 15.seconds)(implicit T: Temporal[IO]): IO[Unit] =
    (run(xa).attempt *> T.sleep(every)).foreverM
}
