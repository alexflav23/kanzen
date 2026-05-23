package com.kanzen

import cats.effect.{IO, IOApp}
import cats.syntax.all._
import com.comcast.ip4s._
import com.kanzen.api.{Admin, Health}
import com.kanzen.config.AppConfig
import org.http4s.HttpApp
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits._
import org.http4s.server.middleware.{CORS, Logger}
import org.typelevel.log4cats.LoggerFactory
import org.typelevel.log4cats.slf4j.Slf4jFactory
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** F00 — backend entrypoint. Loads config (reporting all missing keys), then runs the
  * primary API server (`:8080`, /api + /docs) and the admin health server (`:9990`).
  * Boot order grows here: + Flyway → Doobie transactor → TigerBeetle/S3 → metrics.
  */
object Main extends IOApp.Simple {
  implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]

  private val docs = Http4sServerInterpreter[IO]().toRoutes(
    SwaggerInterpreter().fromEndpoints[IO](List(Health.endpoint), "Kanzen API", "0.1.0")
  )

  private val primaryApp: HttpApp[IO] =
    Logger.httpApp[IO](logHeaders = true, logBody = false)(
      CORS.policy.withAllowOriginAll((Health.routes <+> docs).orNotFound)
    )

  private def server(h: Host, p: Port, app: HttpApp[IO]) =
    EmberServerBuilder.default[IO].withHost(h).withPort(p).withHttpApp(app).build

  def run: IO[Unit] =
    AppConfig.load() match {
      case Left(errors) =>
        IO.raiseError(new RuntimeException(s"Config errors:\n - ${errors.mkString("\n - ")}"))
      case Right(cfg) =>
        for {
          p <- Port.fromInt(cfg.port).liftTo[IO](new RuntimeException(s"bad port ${cfg.port}"))
          a <- Port.fromInt(cfg.adminPort).liftTo[IO](new RuntimeException(s"bad admin port ${cfg.adminPort}"))
          _ <- (server(host"0.0.0.0", p, primaryApp), server(host"0.0.0.0", a, Admin.routes.orNotFound)).tupled.useForever
        } yield ()
    }
}
