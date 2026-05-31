package com.kanzen

import cats.effect.{IO, IOApp}
import cats.syntax.all._
import com.comcast.ip4s._
import com.kanzen.api.{Admin, Api}
import com.kanzen.auth.{Auth, DevAuth, HttpJwks, Jwks}
import com.kanzen.calendar.CalendarSyncWorker
import com.kanzen.config.AppConfig
import com.kanzen.db.Database
import com.kanzen.events.{Consumers, Relay}
import com.kanzen.identity.Principals
import com.kanzen.realtime.RealtimeHub
import com.kanzen.s3.{ObjectStore, S3ObjectStore}
import doobie.util.transactor.Transactor
import org.http4s.HttpApp
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits._
import org.http4s.server.middleware.{CORS, Logger}
import org.http4s.server.websocket.WebSocketBuilder2
import org.typelevel.log4cats.LoggerFactory
import org.typelevel.log4cats.slf4j.Slf4jFactory

import scala.concurrent.duration._

/** F00 — backend entrypoint. Boot order (mirrors athena): load + validate config (report all missing keys) → Flyway
  * migrate → primary API server (`:8080`, `/api` + `/docs`) + admin health server (`:9990`). Grows here: + Doobie
  * transactor → S3 → metrics (Phase 0/1).
  */
object Main extends IOApp.Simple {
  implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]
  private val log = loggerFactory.getLogger

  private def primaryApp(
      auth: Auth,
      xa: Transactor[IO],
      store: ObjectStore,
      blobSecret: String,
      dev: Option[DevAuth],
      hub: RealtimeHub,
      wsb: WebSocketBuilder2[IO]
  ): HttpApp[IO] =
    Logger.httpApp[IO](logHeaders = true, logBody = false)(
      CORS.policy.withAllowOriginAll(Api.routes(auth, xa, store, blobSecret, dev, hub, wsb).orNotFound)
    )

  private def server(h: Host, p: Port, app: HttpApp[IO]) =
    EmberServerBuilder.default[IO].withHost(h).withPort(p).withHttpApp(app).build

  /** The primary server needs the WebSocket builder for F48's `/api/ws`, so it's built via `withHttpWebSocketApp`. */
  private def wsServer(h: Host, p: Port, appOf: WebSocketBuilder2[IO] => HttpApp[IO]) =
    EmberServerBuilder.default[IO].withHost(h).withPort(p).withHttpWebSocketApp(appOf).build

  def run: IO[Unit] =
    AppConfig.load() match {
      case Left(errors) =>
        IO.raiseError(new RuntimeException(s"Config errors:\n - ${errors.mkString("\n - ")}"))
      case Right(cfg) =>
        for {
          _ <- log.info(s"Kanzen booting (env=${cfg.env})")
          n <- Database.runMigrations(cfg.db.url, cfg.db.user, cfg.db.password)
          _ <- log.info(s"Flyway: $n migration(s) applied")
          // Local + no real pool → ephemeral dev auth (mints + verifies its own JWTs).
          // Otherwise JWKS empty until the HTTP-fetching Cognito JWKS lands with a pool.
          dev <-
            if (cfg.env == "local" && cfg.cognito.issuer.isEmpty)
              DevAuth.generate(cfg.cognito.issuer, cfg.cognito.audience).map(Some(_))
            else IO.pure(None)
          _ <- dev.traverse_(_ =>
            log.warn("DEV AUTH ENABLED — POST /api/dev/token mints local JWTs (env=local, no Cognito pool)")
          )
          // Dev → in-memory keyset; a configured Cognito pool → the HTTP-fetching, caching JWKS; otherwise empty.
          jwks <- dev match {
            case Some(d) => IO.pure(d.jwks: Jwks)
            case None if cfg.cognito.jwksUri.nonEmpty =>
              log.info(s"Cognito JWKS: ${cfg.cognito.jwksUri}") *> HttpJwks.http(cfg.cognito.jwksUri).widen[Jwks]
            case None => IO.pure(Jwks.empty)
          }
          p <- Port.fromInt(cfg.port).liftTo[IO](new RuntimeException(s"bad port ${cfg.port}"))
          a <- Port.fromInt(cfg.adminPort).liftTo[IO](new RuntimeException(s"bad admin port ${cfg.adminPort}"))
          // stable secret signing short-lived /api/blobs capability URLs (config so restarts don't break URLs).
          blobSecret = cfg.blobSecret
          _ <- log.info(s"Object store: S3 bucket '${cfg.s3.bucket}'${cfg.s3.endpoint match {
              case "" => " (AWS)"; case e => s" @ $e"
            }}")
          _ <- log.info(s"Serving api :${cfg.port} (/api,/docs) · admin :${cfg.adminPort} (/health)")
          // persistent S3 store (LocalStack in dev, AWS in prod) — bytes survive restarts; bucket ensured on boot
          _ <- S3ObjectStore
            .resource(
              cfg.publicBaseUrl,
              blobSecret,
              cfg.s3.region,
              Some(cfg.s3.endpoint),
              cfg.s3.bucket,
              cfg.s3.accessKey,
              cfg.s3.secretKey
            )
            .use { store =>
              Database.transactor(cfg.db.url, cfg.db.user, cfg.db.password).use { xa =>
                RealtimeHub.create.flatMap { hub =>
                  val auth = Auth(jwks, cfg.cognito.issuer, cfg.cognito.audience, Principals.resolver(xa))
                  val servers = (
                    wsServer(host"0.0.0.0", p, wsb => primaryApp(auth, xa, store, blobSecret, dev, hub, wsb)),
                    server(host"0.0.0.0", a, Admin.routes.orNotFound)
                  ).tupled.useForever
                  // F34: the transactional-outbox relay runs alongside the servers (in-process consumers in sandbox;
                  // Pulsar transport is infra, deferred to hardening). F48: each drained row is also pushed (best-effort)
                  // to the realtime hub → every websocket. A 300ms poll keeps realtime sub-second in dev.
                  val relay = log.info("F34 event relay started") *>
                    Relay.run(xa, Consumers.sandbox, 300.millis, hub.publish)
                  // F32/NL-2: the RAG index reconcile loop — first pass backfills, then keeps every asset + update fresh.
                  val reconcile =
                    log.info("NL-2 RAG index reconcile started") *> com.kanzen.index.IndexReconcile.loop(xa)
                  // F07 Path B: drain the outbound Google-Calendar push queue through the CalendarSync seam (StubCalendarSync
                  // now — it enforces the F44 "Workspace connected" contract; the real Calendar client drops in behind it).
                  val calendarSync =
                    log.info("F07 calendar-sync worker started") *>
                      CalendarSyncWorker.run(xa, new com.kanzen.calendar.StubCalendarSync(new com.kanzen.workspace.StubWorkspaceAuth(xa)))
                  IO.both(servers, IO.both(relay, IO.both(reconcile, calendarSync))).void
                }
              }
            }
        } yield ()
    }
}
