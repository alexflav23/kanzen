package com.kanzen.backup

import io.circe.Json
import io.circe.syntax._

import java.security.MessageDigest

/** F30 — export manifest + integrity checksum + restore-compatibility (self-descriptive backup). */
object BackupService {
  val exportVersion = "1.0.0"
  val schemaVersion = "2026-05"

  def checksum(s: String): String =
    MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8")).map("%02x".format(_)).mkString

  def manifest(counts: Map[String, Long]): Json = {
    val canonical = counts.toList.sortBy(_._1).map { case (k, v) => s"$k=$v" }.mkString(",")
    Json.obj(
      "export_version" -> exportVersion.asJson,
      "schema_version" -> schemaVersion.asJson,
      "object_counts" -> counts.asJson,
      "checksum_algorithm" -> "sha256".asJson,
      "counts_checksum" -> checksum(canonical).asJson
    )
  }

  /** A backup restores into an installation whose schema is the same or newer (lexical YYYY-MM). */
  def restoreCompatible(manifestSchema: String, currentSchema: String): Boolean =
    currentSchema >= manifestSchema

  /** Per-section sha256 over the canonical JSON (tamper detection on validate). */
  def sectionChecksums(sections: Map[String, Json]): Map[String, String] =
    sections.map { case (k, v) => k -> checksum(v.noSpaces) }

  /** The full archive manifest: counts + per-section checksums + schema/version. */
  def archiveManifest(sections: Map[String, Json]): Json = {
    val counts = sections.map { case (k, v) => k -> v.asArray.map(_.size.toLong).getOrElse(0L) }
    val sums = sectionChecksums(sections)
    Json.obj(
      "export_version" -> exportVersion.asJson,
      "schema_version" -> schemaVersion.asJson,
      "checksum_algorithm" -> "sha256".asJson,
      "object_counts" -> counts.asJson,
      "section_checksums" -> sums.asJson
    )
  }

  /** Recompute section checksums and compare to the manifest's — itemised mismatches (AC2). */
  def validate(sections: Map[String, Json], manifest: Json, currentSchema: String): (Boolean, List[String]) = {
    val claimed = manifest.hcursor.get[Map[String, String]]("section_checksums").getOrElse(Map.empty)
    val actual = sectionChecksums(sections)
    val mismatches = (claimed.keySet ++ actual.keySet).toList.sorted.collect {
      case k if claimed.get(k) != actual.get(k) => s"$k: checksum mismatch (archive tampered or incomplete)"
    }
    val mSchema = manifest.hcursor.get[String]("schema_version").getOrElse("")
    val schemaNote =
      if (restoreCompatible(mSchema, currentSchema)) Nil
      else List(s"schema $mSchema not restorable into $currentSchema")
    val errors = mismatches ++ schemaNote
    (errors.isEmpty, errors)
  }
}
