package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
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

/** F32 — natural-language query. The prompt is translated to a structured, **READ-ONLY** intent (Claude in prod;
  * deterministic rules in sandbox), executed against the registry and **permission-filtered** (gated on `asset` read —
  * no leak via NL totals). Never mutates.
  */
object NlQuery {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class QueryReq(prompt: String)
  final case class QueryResult(prompt: String, intent: String, answer: String, count: Option[Long])

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private val cannot: (StatusCode, ApiError) =
    (StatusCode.UnprocessableEntity, ApiError(422, "not_understood", "Could not interpret the query."))

  private def gbp(minor: Long): String = f"£${minor / 100}%,d"
  private def ok(prompt: String, intent: String, answer: String, count: Option[Long]): Out[QueryResult] =
    Right(QueryResult(prompt, intent, answer, count))

  def query(xa: Transactor[IO], p: Principal, prompt: String): IO[Out[QueryResult]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { a =>
        // NL is Principal-only in v1: the asker can see the whole estate, so unscoped aggregates carry no leak
        // (Manager/Staff get 403). Scoped, role-aware NL is a follow-up. Registry read is the floor.
        if (p.role != "principal" || !a.can(Actions.byKey("asset:view")))
          (Left(forbidden): Out[QueryResult]).pure[ConnectionIO]
        else
          NlQueryService.translate(prompt) match {
            case NlQueryService.CountIntent(entity, filter) =>
              NlQueryRepo
                .countAssets(filter)
                .map(n => ok(prompt, s"count:$entity", s"$n ${filter.getOrElse(entity)}(s) in the registry.", Some(n)))
            case NlQueryService.LastPurchaseIntent(category) =>
              NlQueryRepo.lastPurchase(Some(category).filter(_ != "asset")).map {
                case Some((title, date)) =>
                  ok(prompt, "last_purchase", s"Last: $title${date.map(d => s" on $d").getOrElse("")}.", None)
                case None => ok(prompt, "last_purchase", "No matching purchase found.", None)
              }
            case NlQueryService.WhereIsIntent(kw) =>
              if (kw.isEmpty) (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
              else
                NlQueryRepo.whereIs(kw).map {
                  case Some((title, prop, loc)) =>
                    val where = List(prop, loc).flatten match {
                      case Nil => "no location on record"; case xs => xs.mkString(" · ")
                    }
                    ok(prompt, "where_is", s"$title — $where.", None)
                  case None => ok(prompt, "where_is", s"""No asset matching "$kw".""", None)
                }
            case NlQueryService.ValueByCategoryIntent() =>
              NlQueryRepo.valueByCategory.map { rows =>
                val total = rows.map(_._2).sum
                val txt =
                  if (rows.isEmpty) "No costed assets yet."
                  else rows.map { case (c, v) => s"$c ${gbp(v)}" }.mkString(", ") + s" (total ${gbp(total)})."
                ok(prompt, "value_by_category", s"By category: $txt", Some(rows.size.toLong))
              }
            case NlQueryService.SpendIntent(category, monthsN) =>
              NlQueryRepo.spendTotal(category, monthsN).map { case (sum, cnt) =>
                val onCat = category.map(c => s" on $c").getOrElse("")
                val window = if (monthsN == 1) "the last month" else s"the last $monthsN months"
                ok(prompt, "spend", s"${gbp(sum)}$onCat across $cnt approved expense(s) in $window.", Some(cnt))
              }
            case NlQueryService.DueSoonIntent(daysN) =>
              NlQueryRepo.dueSoonCount(daysN).map { case (tasks, maint) =>
                ok(
                  prompt,
                  "due_soon",
                  s"${tasks + maint} due in the next $daysN days ($tasks task(s), $maint maintenance).",
                  Some(tasks + maint)
                )
              }
            case NlQueryService.Unknown(_) => (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
          }
      }
      .transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val queryEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "nl" / "query")
    .in(jsonBody[QueryReq])
    .errorOut(err)
    .out(jsonBody[QueryResult])
    .summary("Natural-language registry query (read-only, permission-filtered)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    queryEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: QueryReq) => query(xa, p, r.prompt))
  )

  val endpoints: List[AnyEndpoint] = List(queryEndpoint)
}
