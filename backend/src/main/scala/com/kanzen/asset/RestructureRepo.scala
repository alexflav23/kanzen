package com.kanzen.asset

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.time.LocalDate
import java.util.UUID

/** F24 — cost allocation for split/convert (sums exactly to the original; remainder spread). */
object RestructureService {
  def splitCost(totalMinor: Long, n: Int): List[Long] = {
    require(n > 0, "n must be > 0")
    val base = totalMinor / n
    val rem = (totalMinor % n).toInt
    (0 until n).map(i => base + (if (i < rem) 1L else 0L)).toList
  }
}

/** F24 — auditable restructure operations (no silent destructive mutation). */
object RestructureRepo {
  def record(kind: String, inputs: Json, outputs: Json): ConnectionIO[UUID] =
    sql"insert into restructure_operations (kind, inputs, outputs) values ($kind, $inputs, $outputs) returning id".query[UUID].unique

  /** Record with the explicit cost-basis before/after (explainability + reversal). */
  def recordFull(kind: String, inputs: Json, outputs: Json, before: Json, after: Json): ConnectionIO[UUID] =
    sql"""insert into restructure_operations (kind, inputs, outputs, cost_basis_before, cost_basis_after)
          values ($kind, $inputs, $outputs, $before, $after) returning id""".query[UUID].unique

  def get(id: UUID): ConnectionIO[Option[(String, Json, Json)]] =
    sql"select kind, inputs, outputs from restructure_operations where id = $id".query[(String, Json, Json)].option

  def costBasisBefore(id: UUID): ConnectionIO[Option[Json]] =
    sql"select cost_basis_before from restructure_operations where id = $id".query[Option[Json]].option.map(_.flatten)

  def markReversed(opId: UUID, byOpId: UUID): ConnectionIO[Int] =
    sql"update restructure_operations set reversed_by = $byOpId where id = $opId".update.run

  // ---- asset lineage / cost basis (non-destructive) ---------------------------------------
  def assetCost(id: UUID): ConnectionIO[Option[Long]] =
    sql"select acquisition_cost_minor from assets where id = $id".query[Option[Long]].option.map(_.flatten)

  def setCost(id: UUID, costMinor: Option[Long]): ConnectionIO[Int] =
    sql"update assets set acquisition_cost_minor = $costMinor where id = $id".update.run

  def setRestructuredFrom(id: UUID, lineage: Json): ConnectionIO[Int] =
    sql"update assets set restructured_from = $lineage where id = $id".update.run

  /** Mark an original as superseded by another asset — kept + linked, never deleted (AC5). */
  def supersede(id: UUID, by: UUID): ConnectionIO[Int] =
    sql"update assets set superseded_at = now(), superseded_by = $by where id = $id".update.run

  /** Supersede with no single survivor (e.g. a split parent). */
  def supersedeNoSurvivor(id: UUID): ConnectionIO[Int] =
    sql"update assets set superseded_at = now() where id = $id".update.run

  def unsupersede(id: UUID): ConnectionIO[Int] =
    sql"update assets set superseded_at = null, superseded_by = null where id = $id".update.run

  /** (owner_id, category_id, title, acquisition_cost_minor) — for legacy children + previews. */
  def assetBasics(id: UUID): ConnectionIO[Option[(Option[UUID], Option[UUID], String, Option[Long])]] =
    sql"select owner_id, category_id, title, acquisition_cost_minor from assets where id = $id"
      .query[(Option[UUID], Option[UUID], String, Option[Long])].option

  def isSuperseded(id: UUID): ConnectionIO[Boolean] =
    sql"select superseded_at is not null from assets where id = $id".query[Boolean].option.map(_.getOrElse(false))

  /** A legacy/child asset: relaxed fields (approximate cost/date, optional category, note). */
  def createBare(ownerId: UUID, title: String, categoryId: Option[UUID], parentId: Option[UUID],
                 costMinor: Option[Long], currency: Option[String], acquisitionDate: Option[LocalDate],
                 uncertaintyNote: Option[String]): ConnectionIO[UUID] =
    sql"""insert into assets (owner_id, title, category_id, parent_asset_id, acquisition_cost_minor,
            acquisition_currency, acquisition_date, uncertainty_note)
          values ($ownerId, $title, $categoryId, $parentId, $costMinor, $currency, $acquisitionDate, $uncertaintyNote)
          returning id""".query[UUID].unique
}
