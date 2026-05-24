package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Auth
import org.http4s.HttpRoutes
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** Phase 0 — assembles the `/api` surface: public health, the secured endpoints,
  * and Swagger/OpenAPI at `/docs`. Every later feature adds its routes here. */
object Api {
  def routes(auth: Auth): HttpRoutes[IO] = {
    val interp  = Http4sServerInterpreter[IO]()
    val secured = interp.toRoutes(Me.serverEndpoint(auth))
    val docs    = interp.toRoutes(
      SwaggerInterpreter().fromEndpoints[IO](List(Health.endpoint, Me.endpoint), "Kanzen API", "0.1.0")
    )
    Health.routes <+> secured <+> docs
  }
}
