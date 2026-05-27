package com.kanzen.docs

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Document(
    id: UUID,
    name: String,
    category: String,
    contentType: Option[String],
    sizeBytes: Option[Long],
    s3Key: Option[String],
    sha256: Option[String],
    visibility: String,
    source: String,
    propertyId: Option[UUID],
    immutable: Boolean
)

/** F05 — in-house evidence store metadata. Originals are immutable (no update path); documents attach polymorphically
  * to any entity.
  */
object DocumentRepo {
  private val cols =
    fr"id, name, category, content_type, size_bytes, s3_key, sha256, visibility, source, property_id, immutable"

  def insert(
      id: UUID,
      ownerId: UUID,
      name: String,
      category: String,
      contentType: Option[String],
      sizeBytes: Option[Long],
      s3Key: String,
      sha256: String,
      visibility: String,
      source: String,
      propertyId: Option[UUID]
  ): ConnectionIO[Document] =
    (fr"""insert into documents (id, owner_id, name, category, content_type, size_bytes, s3_key, sha256, visibility, source, property_id)
          values ($id, $ownerId, $name, $category, $contentType, $sizeBytes, $s3Key, $sha256, $visibility, $source, $propertyId)
          returning""" ++ cols).query[Document].unique

  def find(id: UUID): ConnectionIO[Option[Document]] =
    (fr"select" ++ cols ++ fr"from documents where id = $id and deleted_at is null").query[Document].option

  def findBySha256(sha: String): ConnectionIO[Option[Document]] =
    (fr"select" ++ cols ++ fr"from documents where sha256 = $sha and deleted_at is null limit 1").query[Document].option

  def list(category: Option[String], q: Option[String]): ConnectionIO[List[Document]] = {
    val conds = List(
      Some(fr"deleted_at is null"),
      category.map(c => fr"category = $c"),
      q.map(s => fr"name ilike ${"%" + s + "%"}")
    ).flatten
    val where = conds.reduce((a, b) => a ++ fr"and" ++ b)
    (fr"select" ++ cols ++ fr"from documents where" ++ where ++ fr"order by created_at desc").query[Document].to[List]
  }

  def softDelete(id: UUID): ConnectionIO[Int] =
    sql"update documents set deleted_at = now() where id = $id and deleted_at is null".update.run

  def link(documentId: UUID, targetType: String, targetId: UUID, role: Option[String]): ConnectionIO[Int] =
    sql"""insert into document_links (document_id, target_type, target_id, role)
          values ($documentId, $targetType, $targetId, $role) on conflict do nothing""".update.run

  def unlink(documentId: UUID, targetType: String, targetId: UUID): ConnectionIO[Int] =
    sql"delete from document_links where document_id = $documentId and target_type = $targetType and target_id = $targetId".update.run

  def linksFor(targetType: String, targetId: UUID): ConnectionIO[List[UUID]] =
    sql"select document_id from document_links where target_type = $targetType and target_id = $targetId"
      .query[UUID]
      .to[List]

  /** The live documents attached to a target, newest first. */
  def documentsFor(targetType: String, targetId: UUID): ConnectionIO[List[Document]] =
    (fr"select" ++ cols ++ fr"""from documents
          where id in (select document_id from document_links where target_type = $targetType and target_id = $targetId)
            and deleted_at is null
          order by created_at desc""").query[Document].to[List]

  def targetsOf(documentId: UUID): ConnectionIO[List[(String, UUID)]] =
    sql"select target_type, target_id from document_links where document_id = $documentId"
      .query[(String, UUID)]
      .to[List]
}
