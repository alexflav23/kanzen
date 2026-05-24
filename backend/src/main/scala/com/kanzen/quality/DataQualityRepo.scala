package com.kanzen.quality

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class QualityFlag(id: UUID, assetId: Option[UUID], assetTitle: Option[String], kind: String, severity: String, status: String, createdAt: String)
final case class RegistryHealth(total: Long, photographed: Long, categorised: Long, located: Long, proofed: Long)

/** F23 — data-quality detection + registry-health aggregates. Completeness checks are
  * derived live from the asset's photo/category/location/proof; the scan turns unmet checks
  * into idempotent open flags (one per asset+kind). All queries are registry (`asset`) scoped. */
object DataQualityRepo {
  // category names that count as proof of ownership/value
  private val proofCats = fr"('receipt','invoice','proof','warranty')"

  private def photoExists(idCol: Fragment): Fragment =
    fr"exists(select 1 from document_links dl join documents d on d.id = dl.document_id where dl.target_type = 'asset' and dl.target_id =" ++ idCol ++ fr"and d.category = 'photo' and d.deleted_at is null)"
  private def proofExists(idCol: Fragment): Fragment =
    fr"exists(select 1 from document_links dl join documents d on d.id = dl.document_id where dl.target_type = 'asset' and dl.target_id =" ++ idCol ++ fr"and d.category in" ++ proofCats ++ fr"and d.deleted_at is null)"

  /** The four operational completeness checks for one asset. */
  def checksFor(assetId: UUID): ConnectionIO[Option[CompletenessService.Checks]] = {
    val id = fr"$assetId"
    (fr"select" ++ photoExists(id) ++ fr", a.category_id is not null, a.location_id is not null," ++ proofExists(id) ++
      fr"from assets a where a.id =" ++ id)
      .query[(Boolean, Boolean, Boolean, Boolean)].option
      .map(_.map { case (p, c, l, pr) => CompletenessService.Checks(p, c, l, pr) })
  }

  def registryHealth: ConnectionIO[RegistryHealth] =
    (fr"""select count(*),
            count(*) filter (where""" ++ photoExists(fr"a.id") ++ fr"""),
            count(*) filter (where a.category_id is not null),
            count(*) filter (where a.location_id is not null),
            count(*) filter (where""" ++ proofExists(fr"a.id") ++ fr""")
          from assets a where a.deleted_at is null""")
      .query[(Long, Long, Long, Long, Long)].unique
      .map { case (t, ph, c, l, pr) => RegistryHealth(t, ph, c, l, pr) }

  def openFlags: ConnectionIO[List[QualityFlag]] =
    sql"""select f.id, f.asset_id, a.title, f.kind, f.severity, f.status, f.created_at::text
          from asset_quality_flags f left join assets a on a.id = f.asset_id
          where f.status = 'open' order by f.severity desc, f.created_at desc"""
      .query[QualityFlag].to[List]

  def setStatus(flagId: UUID, status: String): ConnectionIO[Int] =
    sql"update asset_quality_flags set status = $status, resolved_at = case when $status = 'open' then null else now() end where id = $flagId".update.run

  private def raise(assetId: UUID, ownerId: Option[UUID], kind: String, severity: String): ConnectionIO[Int] =
    sql"""insert into asset_quality_flags (owner_id, asset_id, kind, severity) values ($ownerId, $assetId, $kind, $severity)
          on conflict (asset_id, kind) where status = 'open' do nothing""".update.run

  /** Scan all assets and raise open flags for unmet checks (idempotent). Returns flags raised. */
  def scan: ConnectionIO[Int] =
    for {
      assets <- sql"select id, owner_id, acquisition_cost_minor from assets where deleted_at is null"
                  .query[(UUID, Option[UUID], Option[Long])].to[List]
      raised <- assets.traverse { case (id, owner, costMinor) =>
        checksFor(id).flatMap {
          case None => 0.pure[ConnectionIO]
          case Some(c) =>
            val expensive = costMinor.exists(_ >= 150000L) // £1,500+ acquisition without proof
            List(
              (!c.hasPhoto)    -> ("missing_photo", "low"),
              (!c.hasCategory) -> ("no_category", "medium"),
              (!c.hasLocation) -> ("missing_location", "low"),
              (!c.hasProof)    -> ("missing_proof", "medium"),
              (expensive && !c.hasProof) -> ("expensive_no_proof", "high"),
            ).collect { case (true, (k, sev)) => raise(id, owner, k, sev) }.sequence.map(_.sum)
        }
      }.map(_.sum)
    } yield raised
}
