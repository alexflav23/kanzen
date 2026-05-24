package com.kanzen

import cats.effect.{IO, IOApp}
import cats.syntax.all._
import com.comcast.ip4s._
import com.kanzen.api.{Admin, Api}
import com.kanzen.auth.{Auth, DevAuth, Jwks}
import com.kanzen.config.AppConfig
import com.kanzen.db.Database
import doobie.util.transactor.Transactor
import org.http4s.HttpApp
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits._
import org.http4s.server.middleware.{CORS, Logger}
import org.typelevel.log4cats.LoggerFactory
import org.typelevel.log4cats.slf4j.Slf4jFactory

/** F00 — backend entrypoint. Boot order (mirrors athena): load + validate config
  * (report all missing keys) → Flyway migrate → primary API server (`:8080`, `/api`
  * + `/docs`) + admin health server (`:9990`). Grows here: + Doobie transactor →
  * S3 → metrics (Phase 0/1).
  */
object Main extends IOApp.Simple {
  implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]
  private val log = loggerFactory.getLogger

  private def primaryApp(auth: Auth, xa: Transactor[IO], dev: Option[DevAuth]): HttpApp[IO] =
    Logger.httpApp[IO](logHeaders = true, logBody = false)(
      CORS.policy.withAllowOriginAll(Api.routes(auth, xa, dev).orNotFound)
    )

  private def server(h: Host, p: Port, app: HttpApp[IO]) =
    EmberServerBuilder.default[IO].withHost(h).withPort(p).withHttpApp(app).build

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
          dev  <- if (cfg.env == "local" && cfg.cognito.issuer.isEmpty)
                    DevAuth.generate(cfg.cognito.issuer, cfg.cognito.audience).map(Some(_))
                  else IO.pure(None)
          _ <- dev.traverse_(_ => log.warn("DEV AUTH ENABLED — POST /api/dev/token mints local JWTs (env=local, no Cognito pool)"))
          auth = Auth(dev.map(_.jwks).getOrElse(Jwks.empty), cfg.cognito.issuer, cfg.cognito.audience)
          p <- Port.fromInt(cfg.port).liftTo[IO](new RuntimeException(s"bad port ${cfg.port}"))
          a <- Port.fromInt(cfg.adminPort).liftTo[IO](new RuntimeException(s"bad admin port ${cfg.adminPort}"))
          _ <- log.info(s"Serving api :${cfg.port} (/api,/docs) · admin :${cfg.adminPort} (/health)")
          _ <- Database.transactor(cfg.db.url, cfg.db.user, cfg.db.password).use { xa =>
                 (server(host"0.0.0.0", p, primaryApp(auth, xa, dev)),
                  server(host"0.0.0.0", a, Admin.routes.orNotFound)).tupled.useForever
               }
        } yield ()
    }
}
