package com.kanzen.backup

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.postgres.circe.jsonb.implicits._
import io.circe.Json

import java.util.UUID

/** F30 — generic, dependency-ordered export/restore. Each entity section is exported with `json_agg(row_to_json(t))`
  * and restored with `json_populate_recordset(null::<table>, …)`, so the archive round-trips faithfully (row-for-row)
  * without enumerating columns.
  */
object BackupRepo {

  /** Dependency order: parents before children (restore replays in this order; export uses it too). */
  val tables: List[String] = List("users", "properties", "locations", "assets", "bank_transactions")

  // table names come only from the fixed `tables` allowlist — safe to inline as a Fragment.
  private def tbl(name: String): Fragment = Fragment.const(name)

  def countEntities: ConnectionIO[Map[String, Long]] =
    tables.traverse(t => count(t).map(t -> _)).map(_.toMap)

  def count(table: String): ConnectionIO[Long] =
    (fr"select count(*) from" ++ tbl(table)).query[Long].unique

  /** One entity section as a JSON array of rows. */
  def exportTable(table: String): ConnectionIO[Json] =
    (fr"select coalesce(json_agg(row_to_json(t)), '[]'::json) from" ++ tbl(table) ++ fr"t").query[Json].unique

  /** The whole archive's data block: { table -> [rows…] } in dependency order. */
  def exportAll: ConnectionIO[Map[String, Json]] =
    tables.traverse(t => exportTable(t).map(t -> _)).map(_.toMap)

  /** Restore one section faithfully (id-preserving; existing rows untouched). Returns rows inserted. */
  def restoreTable(table: String, rows: Json): ConnectionIO[Int] =
    (fr"insert into" ++ tbl(table) ++ fr"select * from jsonb_populate_recordset(null::" ++ tbl(
      table
    ) ++ fr", $rows) on conflict (id) do nothing").update.run

  def recordExportJob(ownerId: UUID, counts: Json, manifest: Json, sizeBytes: Long): ConnectionIO[UUID] =
    sql"""insert into export_jobs (owner_id, mode, status, object_counts, manifest, size_bytes, finished_at)
          values ($ownerId, 'full', 'completed', $counts, $manifest, $sizeBytes, now()) returning id"""
      .query[UUID]
      .unique

  def recordRestoreJob(ownerId: UUID, mode: String, applied: Json): ConnectionIO[UUID] =
    sql"""insert into restore_jobs (owner_id, mode, status, applied) values ($ownerId, $mode, 'completed', $applied) returning id"""
      .query[UUID]
      .unique
}
