package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Auth
import doobie.util.transactor.Transactor
import org.http4s.HttpRoutes
import sttp.tapir.server.http4s.Http4sServerInterpreter
import sttp.tapir.swagger.bundle.SwaggerInterpreter

/** Phase 0/1 — assembles the `/api` surface: public health, the secured endpoints,
  * and Swagger/OpenAPI at `/docs`. Every later feature adds its routes here. */
object Api {
  def routes(auth: Auth, xa: Transactor[IO]): HttpRoutes[IO] = {
    val interp  = Http4sServerInterpreter[IO]()
    val secured = interp.toRoutes(List(Me.serverEndpoint(auth), Properties.serverEndpoint(auth, xa)))
    val docs    = interp.toRoutes(
      SwaggerInterpreter().fromEndpoints[IO](
        List(Health.endpoint, Me.endpoint, Properties.endpoint), "Kanzen API", "0.1.0")
    )
    Health.routes <+> secured <+> docs
  }
}
