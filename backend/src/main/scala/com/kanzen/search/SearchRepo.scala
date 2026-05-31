package com.kanzen.search

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F28 — full-text search over a denormalised, permission-filterable projection. */
object SearchRepo {
  def index(
      entityType: String,
      entityId: UUID,
      title: String,
      subtitle: Option[String],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[Int] =
    sql"""insert into search_index (tenant_id, entity_type, entity_id, title, subtitle, fts)
          values ($tenantId, $entityType, $entityId, $title, $subtitle,
                  to_tsvector('english', $title || ' ' || coalesce($subtitle, '')))
          on conflict (entity_type, entity_id)
          do update set title = excluded.title, subtitle = excluded.subtitle, fts = excluded.fts""".update.run

  def search(q: String): ConnectionIO[List[(String, String)]] =
    sql"""select entity_type, title from search_index
          where fts @@ plainto_tsquery('english', $q)
          order by ts_rank(fts, plainto_tsquery('english', $q)) desc""".query[(String, String)].to[List]

  /** Hits with entity type + id + title (the API permission-filters by entity-type so a role never sees, via search, an
    * entity it couldn't read directly — no leak via search).
    */
  def hits(q: String): ConnectionIO[List[SearchHit]] =
    sql"""select entity_type, entity_id, title, subtitle from search_index
          where fts @@ plainto_tsquery('english', $q)
          order by ts_rank(fts, plainto_tsquery('english', $q)) desc limit 50""".query[SearchHit].to[List]
}

final case class SearchHit(entityType: String, entityId: UUID, title: String, subtitle: Option[String])
