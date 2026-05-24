package com.kanzen.api

import cats.effect.IO
import io.circe.generic.auto._
import org.http4s.HttpRoutes
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.http4s.Http4sServerInterpreter

/** F00 — health/liveness. The first real Tapir endpoint; proves the config → server → OpenAPI path. Extended into
  * /api/whoami once auth (F01) lands.
  */
object Health {
  final case class HealthStatus(status: String, service: String, version: String)

  val status: HealthStatus = HealthStatus("ok", "kanzen-backend", "0.1.0")

  val endpoint: PublicEndpoint[Unit, Unit, HealthStatus, Any] =
    sttp.tapir.endpoint.get
      .in("api" / "health")
      .out(jsonBody[HealthStatus])
      .summary("Liveness/health of the Kanzen backend")

  val routes: HttpRoutes[IO] =
    Http4sServerInterpreter[IO]().toRoutes(endpoint.serverLogicSuccess(_ => IO.pure(status)))
}
