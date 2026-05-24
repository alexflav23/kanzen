package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.audit.AuditRepo
import com.kanzen.auth.{Auth, DevAuth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.identity.UserRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F02 — the impersonation engine (kinetic-style). An admin (`*`=admin, i.e. the Principal) can **act-as** any user:
  * this mints a token that authenticates as the target but stamps `impersonated_by` with the real admin, so the rest of
  * the app recalibrates to the target's view while audit + the "viewing as" banner always know who is really driving.
  * Every impersonation is audited. (Sandbox mints via dev-auth; prod impersonation is a Cognito token-exchange /
  * admin-API, deferred with the real pool.)
  */
object Impersonate {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ImpersonateReq(email: String)
  final case class ImpersonateResult(token: String, email: String, role: String)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Only an admin can impersonate."))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such active user."))
  private val unavailable: (StatusCode, ApiError) = (
    StatusCode.NotImplemented,
    ApiError(
      501,
      "unavailable",
      "Impersonation needs the dev token mint (sandbox); prod uses a Cognito token-exchange."
    )
  )

  def start(xa: Transactor[IO], dev: Option[DevAuth], p: Principal, req: ImpersonateReq): IO[Out[ImpersonateResult]] =
    dev match {
      case None => IO.pure(Left(unavailable))
      case Some(d) =>
        val tx = for {
          authz <- Authz.authorizer(p.role)
          target <- UserRepo.findByEmail(req.email)
          res <-
            if (!authz.can(Level.Admin, "*")) (Left(forbidden): Out[ImpersonateResult]).pure[ConnectionIO]
            else
              target.filter(_.status == "active") match {
                case None => (Left(notFound): Out[ImpersonateResult]).pure[ConnectionIO]
                case Some(u) =>
                  val token = d.mint(u.email, u.role, Some(p.userId.toString))
                  AuditRepo
                    .write(
                      "user",
                      Some(p.userId),
                      "impersonate.start",
                      Some("user"),
                      Some(u.id),
                      Json.obj("email" -> u.email.asJson, "role" -> u.role.asJson),
                      Some(p.userId)
                    )
                    .as(Right(ImpersonateResult(token, u.email, u.role)): Out[ImpersonateResult])
              }
        } yield res
        tx.transact(xa)
    }

  private val err = statusCode.and(jsonBody[ApiError])

  val endpoint: Endpoint[String, ImpersonateReq, (StatusCode, ApiError), ImpersonateResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "impersonate")
      .in(jsonBody[ImpersonateReq])
      .errorOut(err)
      .out(jsonBody[ImpersonateResult])
      .summary("Act-as another user (admin only; audited). Returns an impersonation token.")

  def serverEndpoints(a: Auth, xa: Transactor[IO], dev: Option[DevAuth]): List[ServerEndpoint[Any, IO]] = List(
    endpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ImpersonateReq) => start(xa, dev, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(endpoint)
}
