package com.kanzen.brand

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** A brand in the global catalogue (specs/03-brand-catalogue.md). */
final case class Brand(id: UUID, name: String, category: String, status: String)

object BrandRepo {
  private def norm(s: String): String = s.trim.toLowerCase

  /** Ranked autocomplete suggestions for a category: this account's hot cache (usage desc) → global usage_count →
    * verified before community → alphabetical. `q` is a prefix over normalized.
    */
  def search(category: String, q: Option[String], ownerId: UUID, limit: Int): ConnectionIO[List[Brand]] = {
    val qFilter = q
      .map(norm)
      .filter(_.nonEmpty)
      .map(s => fr"and b.normalized like ${s + "%"}")
      .getOrElse(Fragment.empty)
    (fr"""select b.id, b.name, b.category, b.status
          from brands b
          left join brand_usage u on u.brand_id = b.id and u.owner_id = $ownerId
          where b.deleted_at is null and b.category = $category """ ++ qFilter ++
      fr"""order by coalesce(u.count, 0) desc, b.usage_count desc, (b.status = 'verified') desc, b.name
          limit $limit""").query[Brand].to[List]
  }

  /** Find-or-create the brand (crowd enrichment) AND record a use (bump global + per-account hot cache) in one shot —
    * so both the catalogue and the hot cache self-populate from real usage.
    */
  def findOrCreateAndUse(category: String, name: String, ownerId: UUID): ConnectionIO[Brand] = {
    val n = norm(name)
    for {
      _ <- sql"""insert into brands (name, normalized, category, status, created_by, usage_count)
                 values ($name, $n, $category, 'community', $ownerId, 0)
                 on conflict (category, normalized) do nothing""".update.run
      b <- sql"""select id, name, category, status from brands
                 where category = $category and normalized = $n and deleted_at is null""".query[Brand].unique
      _ <- sql"update brands set usage_count = usage_count + 1 where id = ${b.id}".update.run
      _ <- sql"""insert into brand_usage (tenant_id, brand_id, owner_id, count, last_used_at)
                 values ('7e000000-0000-0000-0000-000000000001'::uuid, ${b.id}, $ownerId, 1, now())
                 on conflict (brand_id, owner_id)
                 do update set count = brand_usage.count + 1, last_used_at = now()""".update.run
    } yield b
  }
}
