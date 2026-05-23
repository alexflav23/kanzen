package com.kanzen.docs

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Document(id: UUID, name: String, category: String, immutable: Boolean)

/** F05 — in-house evidence store metadata. Originals are immutable (no update path);
  * documents attach polymorphically to any entity.
  */
object DocumentRepo {
  def create(name: String, category: String, s3Key: Option[String], sha256: Option[String], visibility: String): ConnectionIO[Document] =
    sql"""insert into documents (name, category, s3_key, sha256, visibility)
          values ($name, $category, $s3Key, $sha256, $visibility)
          returning id, name, category, immutable""".query[Document].unique

  def link(documentId: UUID, targetType: String, targetId: UUID, role: Option[String]): ConnectionIO[Int] =
    sql"""insert into document_links (document_id, target_type, target_id, role)
          values ($documentId, $targetType, $targetId, $role) on conflict do nothing""".update.run

  def linksFor(targetType: String, targetId: UUID): ConnectionIO[List[UUID]] =
    sql"select document_id from document_links where target_type = $targetType and target_id = $targetId".query[UUID].to[List]
}
