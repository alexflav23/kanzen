package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.AssetRepo
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.finance.ExpenseRepo
import com.kanzen.people.PeopleRepo
import com.kanzen.property.PropertyRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F29 — the dashboard summary: cross-domain counts, each gated by what the principal may read (Manager sees no
  * registry assets; Staff see neither finance nor registry). No totals leak past authz/scope.
  */
object Dashboard {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class Summary(pendingApprovals: Int, properties: Int, assets: Int, expiringPermits: Int)

  def summary(xa: Transactor[IO], p: Principal): IO[Out[Summary]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      props <- PropertyRepo.listForPrincipal(p.userId)
      assets <-
        if (authz.can(Actions.byKey("asset:view"))) AssetRepo.list(p.tenantId, None, None)
        else List.empty.pure[ConnectionIO]
      pending <-
        if (authz.can(Actions.byKey("expense:view"))) ExpenseRepo.list(p.tenantId, Some("pending_approval"))
        else List.empty.pure[ConnectionIO]
      permits <-
        if (p.role != "staff" && authz.can(Actions.byKey("person:view"))) PeopleRepo.expiringPermits(60)
        else List.empty.pure[ConnectionIO]
    } yield Right(Summary(pending.size, props.size, assets.size, permits.size)): Out[Summary]
    tx.transact(xa)
  }

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), Summary, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "dashboard")
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[Summary])
      .summary("Dashboard summary (authz/scope-filtered counts)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    endpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => summary(xa, p))
  )

  val endpoints: List[AnyEndpoint] = List(endpoint)
}
