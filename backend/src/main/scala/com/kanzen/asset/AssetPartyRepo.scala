package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F21 — provenance party-roles on an asset (maker / restorer / appraiser / prior owner / dealer / insurer). */
final case class AssetParty(id: UUID, assetId: UUID, role: String, name: String, note: Option[String])

object AssetPartyRepo {
  private val cols = fr"id, asset_id, role, name, note"

  def list(assetId: UUID): ConnectionIO[List[AssetParty]] =
    (fr"select" ++ cols ++ fr"from asset_parties where asset_id = $assetId order by role, created_at")
      .query[AssetParty]
      .to[List]

  def add(
      assetId: UUID,
      role: String,
      name: String,
      note: Option[String],
      owner: UUID,
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[AssetParty] =
    (fr"""insert into asset_parties (tenant_id, asset_id, role, name, note, owner_id, created_by)
          values ($tenantId, $assetId, $role, $name, $note, $owner, $owner)
          returning""" ++ cols).query[AssetParty].unique

  def delete(id: UUID, assetId: UUID): ConnectionIO[Int] =
    sql"delete from asset_parties where id = $id and asset_id = $assetId".update.run
}
