package com.kanzen.ext

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F33 — polymorphic tags across any entity. */
object TagRepo {
  def createTag(name: String, slug: Option[String]): ConnectionIO[UUID] =
    sql"insert into tags (name, slug) values ($name, $slug) returning id".query[UUID].unique

  def tagEntity(tagId: UUID, entityType: String, entityId: UUID): ConnectionIO[Int] =
    sql"insert into entity_tags (tag_id, entity_type, entity_id) values ($tagId, $entityType, $entityId) on conflict do nothing".update.run

  def tagsFor(entityType: String, entityId: UUID): ConnectionIO[List[String]] =
    sql"""select t.name from entity_tags et join tags t on t.id = et.tag_id
          where et.entity_type = $entityType and et.entity_id = $entityId""".query[String].to[List]
}

/** F33 — user-defined infinite taxonomies (multiple category trees). */
object TaxonomyRepo {
  def create(name: String, appliesTo: String): ConnectionIO[UUID] =
    sql"insert into taxonomies (name, applies_to) values ($name, $appliesTo) returning id".query[UUID].unique

  def addNode(taxonomyId: UUID, parentId: Option[UUID], name: String): ConnectionIO[UUID] =
    sql"insert into taxonomy_nodes (taxonomy_id, parent_id, name) values ($taxonomyId, $parentId, $name) returning id".query[UUID].unique

  def link(nodeId: UUID, entityType: String, entityId: UUID): ConnectionIO[Int] =
    sql"insert into entity_taxonomy_links (taxonomy_node_id, entity_type, entity_id) values ($nodeId, $entityType, $entityId) on conflict do nothing".update.run

  def nodes(taxonomyId: UUID): ConnectionIO[List[(UUID, Option[UUID], String)]] =
    sql"select id, parent_id, name from taxonomy_nodes where taxonomy_id = $taxonomyId".query[(UUID, Option[UUID], String)].to[List]
}
