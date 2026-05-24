package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.backup.{BackupRepo, BackupService}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F30 — backup/export/restore. Principal-only. The archive is a self-descriptive JSON document (manifest +
  * dependency-ordered entity sections + per-section sha256). Restore replays sections in dependency order and is
  * id-preserving, so a delete→restore round-trips faithfully. `age` encryption + S3 binary streaming + immutable
  * snapshots are deferred.
  */
object Backup {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class Archive(manifest: Json, data: Map[String, Json])
  final case class ExportResult(jobId: java.util.UUID, manifest: Json, archive: Archive)
  final case class ValidateReq(archive: Archive)
  final case class ValidateResult(valid: Boolean, errors: List[String])
  final case class RestoreReq(archive: Archive, mode: String) // dry_run | full
  final case class RestoreResult(mode: String, applied: Map[String, Int], wouldApply: Map[String, Long])

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "backup is Principal-only"))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private val invalid: (StatusCode, ApiError) =
    (StatusCode.UnprocessableEntity, ApiError(422, "invalid_archive", "Archive failed validation."))

  private def principalOnly[A](p: Principal)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(a =>
        if (a.can(Level.Admin, "backup")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  /** AC1 — full export: dependency-ordered sections + a manifest (counts, per-section sha256). */
  def export(xa: Transactor[IO], p: Principal): IO[Out[ExportResult]] =
    principalOnly(p) {
      for {
        sections <- BackupRepo.exportAll
        manifest = BackupService.archiveManifest(sections)
        size = manifest.noSpaces.length.toLong + sections.values.map(_.noSpaces.length.toLong).sum
        job <- BackupRepo.recordExportJob(
          p.userId,
          manifest.hcursor.get[Json]("object_counts").getOrElse(Json.obj()),
          manifest,
          size
        )
      } yield ExportResult(job, manifest, Archive(manifest, sections))
    }.transact(xa)

  /** AC2 — validate: recompute section checksums + schema compat; itemised errors. */
  def validate(xa: Transactor[IO], p: Principal, r: ValidateReq): IO[Out[ValidateResult]] =
    principalOnly(p) {
      val (ok, errors) = BackupService.validate(r.archive.data, r.archive.manifest, BackupService.schemaVersion)
      ValidateResult(ok, errors).pure[ConnectionIO]
    }.transact(xa)

  /** AC3 dry-run (writes nothing) / AC4 full restore (dependency order, id-preserving). */
  def restore(xa: Transactor[IO], p: Principal, r: RestoreReq): IO[Out[RestoreResult]] = {
    if (r.mode != "dry_run" && r.mode != "full") IO.pure(Left(badReq("mode must be dry_run or full")))
    else {
      val tx = for {
        a <- Authz.authorizer(p.role)
        res <-
          if (!a.can(Level.Admin, "backup")) (Left(forbidden): Out[RestoreResult]).pure[ConnectionIO]
          else {
            val (ok, _) = BackupService.validate(r.archive.data, r.archive.manifest, BackupService.schemaVersion)
            if (!ok) (Left(invalid): Out[RestoreResult]).pure[ConnectionIO]
            else if (r.mode == "dry_run") {
              // report counts per section in dependency order; write nothing
              val plan = BackupRepo.tables
                .flatMap(t => r.archive.data.get(t).map(j => t -> j.asArray.map(_.size.toLong).getOrElse(0L)))
                .toMap
              BackupRepo
                .recordRestoreJob(p.userId, "dry_run", plan.asJson)
                .as(Right(RestoreResult("dry_run", Map.empty, plan)): Out[RestoreResult])
            } else
              for {
                applied <- BackupRepo.tables
                  .traverse { t =>
                    r.archive.data.get(t) match {
                      case Some(rows) => BackupRepo.restoreTable(t, rows).map(n => t -> n)
                      case None => (t -> 0).pure[ConnectionIO]
                    }
                  }
                  .map(_.toMap)
                _ <- BackupRepo.recordRestoreJob(p.userId, "full", applied.asJson)
              } yield Right(RestoreResult("full", applied, Map.empty)): Out[RestoreResult]
          }
      } yield res
      tx.transact(xa)
    }
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val exportEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "backup" / "export")
    .errorOut(err)
    .out(jsonBody[ExportResult])
    .summary("Run a full export (self-descriptive archive + manifest)")
  val validateEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "backup" / "validate")
    .in(jsonBody[ValidateReq])
    .errorOut(err)
    .out(jsonBody[ValidateResult])
    .summary("Validate an archive (checksums + schema compat)")
  val restoreEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "backup" / "restore")
    .in(jsonBody[RestoreReq])
    .errorOut(err)
    .out(jsonBody[RestoreResult])
    .summary("Restore (dry_run reports plan; full replays in dependency order)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    exportEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => export(xa, p)),
    validateEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ValidateReq) => validate(xa, p, r)),
    restoreEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: RestoreReq) => restore(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(exportEndpoint, validateEndpoint, restoreEndpoint)
}
