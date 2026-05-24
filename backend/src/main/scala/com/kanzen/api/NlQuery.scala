package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.Authz
import com.kanzen.nl.{NlQueryRepo, NlQueryService}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F32 — natural-language query. The prompt is translated to a structured, **READ-ONLY**
  * intent (Claude in prod; deterministic rules in sandbox), executed against the registry and
  * **permission-filtered** (gated on `asset` read — no leak via NL totals). Never mutates. */
object NlQuery {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class QueryReq(prompt: String)
  final case class QueryResult(prompt: String, intent: String, answer: String, count: Option[Long])

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private val cannot: (StatusCode, ApiError)    = (StatusCode.UnprocessableEntity, ApiError(422, "not_understood", "Could not interpret the query."))

  def query(xa: Transactor[IO], p: Principal, prompt: String): IO[Out[QueryResult]] =
    Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("asset")) (Left(forbidden): Out[QueryResult]).pure[ConnectionIO] // NL reads the registry → registry read
      else NlQueryService.translate(prompt) match {
        case NlQueryService.CountIntent(entity, filter) =>
          NlQueryRepo.countAssets(filter).map(n => Right(QueryResult(prompt, s"count:$entity", s"$n ${filter.getOrElse(entity)}(s)", Some(n))): Out[QueryResult])
        case NlQueryService.LastPurchaseIntent(category) =>
          NlQueryRepo.lastPurchase(Some(category).filter(_ != "asset")).map {
            case Some((title, date)) => Right(QueryResult(prompt, "last_purchase", s"Last: $title${date.map(d => s" on $d").getOrElse("")}", None)): Out[QueryResult]
            case None                => Right(QueryResult(prompt, "last_purchase", "No matching purchase found.", None)): Out[QueryResult]
          }
        case NlQueryService.Unknown(_) => (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
      }
    }.transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val queryEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "nl" / "query").in(jsonBody[QueryReq]).errorOut(err).out(jsonBody[QueryResult]).summary("Natural-language registry query (read-only, permission-filtered)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    queryEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: QueryReq) => query(xa, p, r.prompt)),
  )

  val endpoints: List[AnyEndpoint] = List(queryEndpoint)
}
