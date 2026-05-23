package com.kanzen.api

import cats.effect.IO
import org.http4s.HttpRoutes
import org.http4s.dsl.io._

/** F00 admin server (`:9990`) — the ALB/health-probe surface (Hypervolt pattern). */
object Admin {
  val routes: HttpRoutes[IO] = HttpRoutes.of[IO] { case GET -> Root / "health" =>
    Ok("ok")
  }
}
