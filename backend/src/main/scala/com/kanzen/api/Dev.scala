package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.DevAuth
import io.circe.generic.auto._
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** DEV-ONLY — `POST /api/dev/token`: mint a local JWT for a role, so the web app can
  * log in without a live Cognito pool. Mounted only when `env=local` (see Main). */
object Dev {
  final case class TokenReq(email: String, role: String)
  final case class TokenResp(token: String, note: String)

  val endpoint: PublicEndpoint[TokenReq, Unit, TokenResp, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "dev" / "token")
      .in(jsonBody[TokenReq])
      .out(jsonBody[TokenResp])
      .summary("DEV ONLY — mint a local JWT for a role (no live Cognito pool)")

  def serverEndpoint(dev: DevAuth): ServerEndpoint[Any, IO] =
    endpoint.serverLogicSuccess(req =>
      IO.pure(TokenResp(dev.mint(req.email, req.role), "dev token — local only, expires in 12h")))
}
