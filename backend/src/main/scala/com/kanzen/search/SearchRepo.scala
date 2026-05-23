package com.kanzen.search

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F28 — full-text search over a denormalised, permission-filterable projection. */
object SearchRepo {
  def index(entityType: String, entityId: UUID, title: String, subtitle: Option[String]): ConnectionIO[Int] =
    sql"""insert into search_index (entity_type, entity_id, title, subtitle, fts)
          values ($entityType, $entityId, $title, $subtitle,
                  to_tsvector('english', $title || ' ' || coalesce($subtitle, '')))
          on conflict (entity_type, entity_id)
          do update set title = excluded.title, subtitle = excluded.subtitle, fts = excluded.fts""".update.run

  def search(q: String): ConnectionIO[List[(String, String)]] =
    sql"""select entity_type, title from search_index
          where fts @@ plainto_tsquery('english', $q)
          order by ts_rank(fts, plainto_tsquery('english', $q)) desc""".query[(String, String)].to[List]
}
