package com.kanzen.ext

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

final case class Tag(id: UUID, name: String)
final case class Taxonomy(id: UUID, name: String, appliesTo: String, isSystem: Boolean)
final case class CustomFieldDef(
    id: UUID,
    entityType: String,
    key: String,
    label: String,
    `type`: String,
    enumValues: Option[Json],
    sensitive: Boolean
)

/** F33 — polymorphic tags across any entity. */
object TagRepo {
  def createTag(
      name: String,
      slug: Option[String],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"insert into tags (tenant_id, name, slug) values ($tenantId, $name, $slug) returning id".query[UUID].unique

  def list: ConnectionIO[List[Tag]] =
    sql"select id, name from tags order by name".query[Tag].to[List]

  def tagEntity(tagId: UUID, entityType: String, entityId: UUID): ConnectionIO[Int] =
    sql"insert into entity_tags (tag_id, entity_type, entity_id) values ($tagId, $entityType, $entityId) on conflict do nothing".update.run

  def untagEntity(tagId: UUID, entityType: String, entityId: UUID): ConnectionIO[Int] =
    sql"delete from entity_tags where tag_id = $tagId and entity_type = $entityType and entity_id = $entityId".update.run

  def tagsFor(entityType: String, entityId: UUID): ConnectionIO[List[String]] =
    sql"""select t.name from entity_tags et join tags t on t.id = et.tag_id
          where et.entity_type = $entityType and et.entity_id = $entityId""".query[String].to[List]

  /** The tags on an entity, with ids (for chip display + removal). */
  def tagsForEntity(entityType: String, entityId: UUID): ConnectionIO[List[Tag]] =
    sql"""select t.id, t.name from entity_tags et join tags t on t.id = et.tag_id
          where et.entity_type = $entityType and et.entity_id = $entityId order by t.name"""
      .query[Tag]
      .to[List]

  /** AC3 — every entity carrying a tag (across entity types), for search facets. */
  def entitiesWithTag(tagId: UUID): ConnectionIO[List[(String, UUID)]] =
    sql"select entity_type, entity_id from entity_tags where tag_id = $tagId".query[(String, UUID)].to[List]
}

/** F33 — user-defined infinite taxonomies (multiple category trees). */
object TaxonomyRepo {
  def create(
      name: String,
      appliesTo: String,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"insert into taxonomies (tenant_id, name, applies_to) values ($tenantId, $name, $appliesTo) returning id"
      .query[UUID]
      .unique

  def list: ConnectionIO[List[Taxonomy]] =
    sql"select id, name, applies_to, is_system from taxonomies order by name".query[Taxonomy].to[List]

  def addNode(taxonomyId: UUID, parentId: Option[UUID], name: String): ConnectionIO[UUID] =
    sql"insert into taxonomy_nodes (taxonomy_id, parent_id, name) values ($taxonomyId, $parentId, $name) returning id"
      .query[UUID]
      .unique

  def exists(taxonomyId: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from taxonomies where id = $taxonomyId)".query[Boolean].unique

  def link(nodeId: UUID, entityType: String, entityId: UUID): ConnectionIO[Int] =
    sql"insert into entity_taxonomy_links (taxonomy_node_id, entity_type, entity_id) values ($nodeId, $entityType, $entityId) on conflict do nothing".update.run

  def nodes(taxonomyId: UUID): ConnectionIO[List[(UUID, Option[UUID], String)]] =
    sql"select id, parent_id, name from taxonomy_nodes where taxonomy_id = $taxonomyId"
      .query[(UUID, Option[UUID], String)]
      .to[List]

  /** the taxonomy nodes an entity is linked to (for its detail chips). */
  def linksFor(entityType: String, entityId: UUID): ConnectionIO[List[(UUID, String)]] =
    sql"""select n.id, n.name from entity_taxonomy_links l join taxonomy_nodes n on n.id = l.taxonomy_node_id
          where l.entity_type = $entityType and l.entity_id = $entityId""".query[(UUID, String)].to[List]
}

/** F33 — typed custom-field definitions (values live in the host's `attributes`). */
object CustomFieldRepo {
  def create(
      ownerId: UUID,
      entityType: String,
      key: String,
      label: String,
      typ: String,
      enumValues: Option[Json],
      sensitive: Boolean,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[CustomFieldDef] =
    sql"""insert into custom_field_definitions (tenant_id, owner_id, entity_type, key, label, type, enum_values, sensitive)
          values ($tenantId, $ownerId, $entityType, $key, $label, $typ, $enumValues, $sensitive)
          returning id, entity_type, key, label, type, enum_values, sensitive""".query[CustomFieldDef].unique

  def listFor(entityType: String): ConnectionIO[List[CustomFieldDef]] =
    sql"""select id, entity_type, key, label, type, enum_values, sensitive from custom_field_definitions
          where entity_type = $entityType order by sort_order, label""".query[CustomFieldDef].to[List]

  def delete(id: UUID): ConnectionIO[Int] =
    sql"delete from custom_field_definitions where id = $id".update.run

  /** AC5 — the keys a non-Principal must not see for an entity type (sensitive custom fields). */
  def sensitiveKeys(entityType: String): ConnectionIO[List[String]] =
    sql"select key from custom_field_definitions where entity_type = $entityType and sensitive".query[String].to[List]
}

/** F33 — `attributes` helpers: strip sensitive custom-field keys for non-Principal readers (AC5). */
object Attributes {
  def strip(attributes: Json, sensitiveKeys: List[String]): Json =
    attributes.asObject match {
      case Some(o) => Json.fromJsonObject(sensitiveKeys.foldLeft(o)((acc, k) => acc.remove(k)))
      case None => attributes
    }
}
