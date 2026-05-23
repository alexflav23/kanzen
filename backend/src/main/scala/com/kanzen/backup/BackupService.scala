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
      "counts_checksum" -> checksum(canonical).asJson,
    )
  }

  /** A backup restores into an installation whose schema is the same or newer (lexical YYYY-MM). */
  def restoreCompatible(manifestSchema: String, currentSchema: String): Boolean =
    currentSchema >= manifestSchema
}
