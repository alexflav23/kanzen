package com.kanzen

import cats.effect.{IO, IOApp}
import cats.syntax.all._
import com.comcast.ip4s._
import com.kanzen.api.Health
import org.http4s.HttpApp
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.implicits._
import org.http4s.server.middleware.{CORS, Logger}
import org.typelevel.log4cats.LoggerFactory
import org.typelevel.log4cats.slf4j.Slf4jFactory
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** F00 — backend entrypoint. cats-effect IOApp + http4s Ember + Tapir + Swagger,
  * mirroring the Hypervolt (athena) pattern. Boot order grows here: config →
  * Flyway → Doobie transactor → TigerBeetle/S3 clients → admin/metrics/primary servers.
  */
object Main extends IOApp.Simple {
  implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]

  private val docs = Http4sServerInterpreter[IO]().toRoutes(
    SwaggerInterpreter().fromEndpoints[IO](List(Health.endpoint), "Kanzen API", "0.1.0")
  )

  val httpApp: HttpApp[IO] =
    Logger.httpApp[IO](logHeaders = true, logBody = false)(
      CORS.policy.withAllowOriginAll((Health.routes <+> docs).orNotFound)
    )

  def run: IO[Unit] =
    EmberServerBuilder
      .default[IO]
      .withHost(host"0.0.0.0")
      .withPort(port"8080")
      .withHttpApp(httpApp)
      .build
      .useForever
}
