package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.quality.{CompletenessService, DataQualityRepo, QualityFlag, RegistryHealth}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F23 — completeness scoring + data-quality flags + registry health. Registry-private:
  * completeness/health gated on `asset` read (Manager carve-out, Staff none); the flag
  * stream + scan/resolve gated on `data_quality` (Principal writes, Manager reads). */
object DataQuality {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class Completeness(score: Int, missing: List[String])
  final case class FlagView(id: UUID, assetId: Option[UUID], assetTitle: Option[String], kind: String, severity: String)
  final case class HealthView(total: Long, photographedPct: Int, categorisedPct: Int, locatedPct: Int, proofPct: Int)
  final case class ScanResult(flagsRaised: Int)
  final case class Ok(ok: Boolean)

  private def fv(f: QualityFlag): FlagView = FlagView(f.id, f.assetId, f.assetTitle, f.kind, f.severity)
  private def pct(n: Long, total: Long): Int = if (total <= 0) 0 else ((n * 100) / total).toInt
  private def hv(h: RegistryHealth): HealthView =
    HealthView(h.total, pct(h.photographed, h.total), pct(h.categorised, h.total), pct(h.located, h.total), pct(h.proofed, h.total))

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))

  private def gate[A](p: Principal, level: Level, resource: String)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.can(level, resource)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  def completeness(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[Completeness]] =
    Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("asset")) (Left(forbidden): Out[Completeness]).pure[ConnectionIO]
      else DataQualityRepo.checksFor(assetId).map {
        case None    => Left(notFound)
        case Some(c) => Right(Completeness(CompletenessService.score(c), CompletenessService.missing(c)))
      }
    }.transact(xa)

  def registryHealth(xa: Transactor[IO], p: Principal): IO[Out[HealthView]] =
    gate(p, Level.Read, "asset")(DataQualityRepo.registryHealth.map(hv)).transact(xa)

  def stream(xa: Transactor[IO], p: Principal): IO[Out[List[FlagView]]] =
    gate(p, Level.Read, "data_quality")(DataQualityRepo.openFlags.map(_.map(fv))).transact(xa)

  def scan(xa: Transactor[IO], p: Principal): IO[Out[ScanResult]] =
    gate(p, Level.Write, "data_quality")(DataQualityRepo.scan.map(ScanResult(_))).transact(xa)

  def resolve(xa: Transactor[IO], p: Principal, flagId: UUID, status: String): IO[Out[Ok]] =
    gate(p, Level.Write, "data_quality")(DataQualityRepo.setStatus(flagId, status).map(n => Ok(n > 0))).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val completenessEndpoint = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "assets" / path[UUID]("id") / "completeness").errorOut(err).out(jsonBody[Completeness]).summary("An asset's completeness score + improve hints")
  val healthEndpoint       = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "insights" / "registry-health").errorOut(err).out(jsonBody[HealthView]).summary("Registry health aggregate")
  val streamEndpoint       = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "data-quality").errorOut(err).out(jsonBody[List[FlagView]]).summary("Open data-quality flags (Inbox stream)")
  val scanEndpoint         = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "data-quality" / "scan").errorOut(err).out(jsonBody[ScanResult]).summary("Scan the registry and raise flags (Principal)")
  val resolveEndpoint      = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "data-quality" / path[UUID]("flagId") / "resolve").errorOut(err).out(jsonBody[Ok]).summary("Resolve a flag")
  val dismissEndpoint      = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "data-quality" / path[UUID]("flagId") / "dismiss").errorOut(err).out(jsonBody[Ok]).summary("Dismiss a flag (false positive)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    completenessEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => completeness(xa, p, id)),
    healthEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => registryHealth(xa, p)),
    streamEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => stream(xa, p)),
    scanEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => scan(xa, p)),
    resolveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => resolve(xa, p, id, "resolved")),
    dismissEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => resolve(xa, p, id, "dismissed")),
  )

  val endpoints: List[AnyEndpoint] = List(completenessEndpoint, healthEndpoint, streamEndpoint, scanEndpoint, resolveEndpoint, dismissEndpoint)
}
