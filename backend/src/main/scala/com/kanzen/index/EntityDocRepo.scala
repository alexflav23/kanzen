package com.kanzen.index

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F32 / NL-2 — the RAG index store. `upsert` is idempotent per entity (the IndexConsumer re-renders on every event);
  * `search` is Postgres FTS for the sandbox, behind which pgvector similarity wires in for prod.
  */
final case class RenderedDoc(
    entityType: String,
    entityId: UUID,
    owner: Option[UUID],
    property: Option[UUID],
    visibility: String,
    title: String,
    body: String
)
final case class DocHit(entityType: String, entityId: UUID, title: String, body: String, rank: Double)

object EntityDocRepo {
  def upsert(d: RenderedDoc): ConnectionIO[Int] =
    sql"""insert into entity_documents (tenant_id, entity_type, entity_id, owner_id, property_id, visibility, title, body, indexed_at)
          values ('7e000000-0000-0000-0000-000000000001'::uuid, ${d.entityType}, ${d.entityId}, ${d.owner}, ${d.property}, ${d.visibility}, ${d.title}, ${d.body}, now())
          on conflict (entity_type, entity_id) do update set
            owner_id = excluded.owner_id, property_id = excluded.property_id, visibility = excluded.visibility,
            title = excluded.title, body = excluded.body, indexed_at = now()""".update.run

  /** Top-K FTS matches, ranked. Builds an OR query from the prompt's lexemes — plainto_tsquery ANDs them, which is too
    * strict for a natural-language question with filler words ("tell me about…") — then ranks by relevance, so the most
    * relevant document surfaces even when the question carries extra words. Unscoped here: NL is Principal-only in v1
    * (the endpoint gate is the scope boundary); the stored owner/property/visibility columns drive scoped retrieval
    * when multi-role NL lands.
    */
  def search(query: String, limit: Int): ConnectionIO[List[DocHit]] =
    sql"""with q as (select replace(plainto_tsquery('english', $query)::text, ' & ', ' | ')::tsquery as tq)
          select d.entity_type, d.entity_id, d.title, d.body, ts_rank(d.fts, q.tq)
          from entity_documents d, q
          where q.tq <> ''::tsquery and d.fts @@ q.tq
          order by ts_rank(d.fts, q.tq) desc
          limit $limit""".query[DocHit].to[List]

  def count: ConnectionIO[Long] = sql"select count(*) from entity_documents".query[Long].unique
  def countOf(entityType: String): ConnectionIO[Long] =
    sql"select count(*) from entity_documents where entity_type = $entityType".query[Long].unique
}
