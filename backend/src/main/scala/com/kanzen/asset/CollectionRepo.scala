package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F04 — asset collections: named groupings of registry assets (e.g. "Watches"). Registry-private, like assets. No
  * aggregate value here — that waits on the valuation-reporting decision.
  */
final case class Collection(id: UUID, name: String, description: Option[String], memberCount: Int)
final case class CollectionMember(assetId: UUID, title: String)

object CollectionRepo {
  def list: ConnectionIO[List[Collection]] =
    sql"""select c.id, c.name, c.description,
            (select count(*) from collection_members m where m.collection_id = c.id)
          from collections c where c.deleted_at is null order by c.name"""
      .query[(UUID, String, Option[String], Int)]
      .to[List]
      .map(_.map { case (i, n, d, ct) => Collection(i, n, d, ct) })

  def members(collectionId: UUID): ConnectionIO[List[CollectionMember]] =
    sql"""select a.id, a.title from collection_members m join assets a on a.id = m.asset_id
          where m.collection_id = $collectionId and a.deleted_at is null order by a.title"""
      .query[(UUID, String)]
      .to[List]
      .map(_.map { case (i, t) => CollectionMember(i, t) })

  /** The collections a given asset belongs to (for the asset-detail "in collections" display). */
  def forAsset(assetId: UUID): ConnectionIO[List[(UUID, String)]] =
    sql"""select c.id, c.name from collection_members m join collections c on c.id = m.collection_id
          where m.asset_id = $assetId and c.deleted_at is null order by c.name"""
      .query[(UUID, String)]
      .to[List]

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from collections where id = $id and deleted_at is null)".query[Boolean].unique

  def create(
      ownerId: UUID,
      name: String,
      description: Option[String],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"insert into collections (tenant_id, owner_id, name, description) values ($tenantId, $ownerId, $name, $description) returning id"
      .query[UUID]
      .unique

  def addMember(collectionId: UUID, assetId: UUID): ConnectionIO[Int] =
    sql"insert into collection_members (collection_id, asset_id) values ($collectionId, $assetId) on conflict do nothing".update.run
}
