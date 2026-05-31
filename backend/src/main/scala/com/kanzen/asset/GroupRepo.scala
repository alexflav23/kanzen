package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F04 (W1.5) — asset groups: structural **peer** groupings (e.g. four chairs from one order), distinct from
  * `parent_asset_id` structured sets and from logical collections.
  */
final case class AssetGroup(id: UUID, name: String, kind: String, notes: Option[String], memberCount: Int)
final case class AssetGroupRef(id: UUID, name: String, kind: String)

object GroupRepo {
  def list: ConnectionIO[List[AssetGroup]] =
    sql"""select g.id, g.name, g.kind, g.notes,
            (select count(*) from asset_group_members m where m.group_id = g.id)
          from asset_groups g where g.deleted_at is null order by g.name"""
      .query[(UUID, String, String, Option[String], Int)]
      .to[List]
      .map(_.map { case (i, n, k, nt, ct) => AssetGroup(i, n, k, nt, ct) })

  def create(
      ownerId: UUID,
      name: String,
      kind: String,
      notes: Option[String],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[UUID] =
    sql"insert into asset_groups (tenant_id, owner_id, name, kind, notes) values ($tenantId, $ownerId, $name, $kind, $notes) returning id"
      .query[UUID]
      .unique

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from asset_groups where id = $id and deleted_at is null)".query[Boolean].unique

  def addMember(groupId: UUID, assetId: UUID): ConnectionIO[Int] =
    sql"insert into asset_group_members (group_id, asset_id) values ($groupId, $assetId) on conflict do nothing".update.run

  def removeMember(groupId: UUID, assetId: UUID): ConnectionIO[Int] =
    sql"delete from asset_group_members where group_id = $groupId and asset_id = $assetId".update.run

  /** The groups a given asset belongs to (for the asset-detail "groups" display). */
  def forAsset(assetId: UUID): ConnectionIO[List[AssetGroupRef]] =
    sql"""select g.id, g.name, g.kind from asset_group_members m join asset_groups g on g.id = m.group_id
          where m.asset_id = $assetId and g.deleted_at is null order by g.name"""
      .query[(UUID, String, String)]
      .to[List]
      .map(_.map { case (i, n, k) => AssetGroupRef(i, n, k) })

  /** The assets in a group. */
  def members(groupId: UUID): ConnectionIO[List[(UUID, String)]] =
    sql"""select a.id, a.title from asset_group_members m join assets a on a.id = m.asset_id
          where m.group_id = $groupId and a.deleted_at is null order by a.title""".query[(UUID, String)].to[List]
}
