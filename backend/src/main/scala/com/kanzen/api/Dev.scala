package com.kanzen.api

import cats.effect.IO
import com.kanzen.auth.DevAuth
import com.kanzen.mail.{OutboundEmail, OutboundEmailRepo}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** DEV-ONLY — `POST /api/dev/token`: mint a local JWT for a role, so the web app can log in without a live Cognito
  * pool. `GET /api/dev/outbox`: read the StubMailer's recorded emails (so dev/e2e can complete the magic-link loop
  * without a live SES). Mounted only when `env=local` (see Main).
  */
object Dev {
  final case class TokenReq(email: String, role: String)
  final case class TokenResp(token: String, note: String)

  val endpoint: PublicEndpoint[TokenReq, Unit, TokenResp, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "dev" / "token")
      .in(jsonBody[TokenReq])
      .out(jsonBody[TokenResp])
      .summary("DEV ONLY — mint a local JWT for a role (no live Cognito pool)")

  val outboxEndpoint: PublicEndpoint[Option[String], Unit, List[OutboundEmail], Any] =
    sttp.tapir.endpoint.get
      .in("api" / "dev" / "outbox")
      .in(query[Option[String]]("to"))
      .out(jsonBody[List[OutboundEmail]])
      .summary("DEV ONLY — the StubMailer's recorded outbound emails (verification links etc.)")

  def serverEndpoint(dev: DevAuth): ServerEndpoint[Any, IO] =
    endpoint.serverLogicSuccess(req =>
      IO.pure(TokenResp(dev.mint(req.email, req.role), "dev token — local only, expires in 12h"))
    )

  def outboxServerEndpoint(xa: Transactor[IO]): ServerEndpoint[Any, IO] =
    outboxEndpoint.serverLogicSuccess(to => OutboundEmailRepo.recent(to, 20).transact(xa))
}
