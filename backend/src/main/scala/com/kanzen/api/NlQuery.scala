package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.index.EntityDocRepo
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

  /** A formatted answer: a one-line `answer` summary + optional structured `items` (rendered as a list) so the UI can
    * present lists cleanly instead of a run-on paragraph.
    */
  final case class NlItem(title: String, subtitle: Option[String])
  final case class QueryResult(
      prompt: String,
      intent: String,
      answer: String,
      count: Option[Long],
      items: List[NlItem] = Nil
  )

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private val cannot: (StatusCode, ApiError) =
    (StatusCode.UnprocessableEntity, ApiError(422, "not_understood", "Could not interpret the query."))

  private def gbp(minor: Long): String = f"£${minor / 100}%,d"
  private def ok(prompt: String, intent: String, answer: String, count: Option[Long]): Out[QueryResult] =
    Right(QueryResult(prompt, intent, answer, count))
  private def okItems(prompt: String, intent: String, answer: String, items: List[NlItem]): Out[QueryResult] =
    Right(QueryResult(prompt, intent, answer, Some(items.size.toLong), items))
  private def snippet(b: String): String =
    if (b.length <= 320) b else b.take(320).reverse.dropWhile(_ != ' ').reverse.trim + "…"

  def query(
      xa: Transactor[IO],
      p: Principal,
      prompt: String,
      parser: NlQueryService.IntentParser = NlQueryService.DeterministicIntentParser
  ): IO[Out[QueryResult]] =
    // NL is Principal-only in v1: the asker can see the whole estate, so unscoped aggregates carry no leak
    // (Manager/Staff get 403). Scoped, role-aware NL is a follow-up. Registry read is the floor.
    Authz.forUser(p.userId, p.role).transact(xa).flatMap { a =>
      if (p.role != "principal" || !a.can(Actions.byKey("asset:view"))) IO.pure(Left(forbidden): Out[QueryResult])
      else
        // Bedrock/F32: parse the prompt → a typed read-only intent (the security floor) through the seam, then execute
        // it under the same scope filter. The parser is swappable (deterministic now, Bedrock later); exec is unchanged.
        parser.parse(prompt).flatMap { intent =>
          (intent match {
            case NlQueryService.CountIntent(entity, filter) =>
              NlQueryRepo
                .countAssets(filter)
                .map(n => ok(prompt, s"count:$entity", s"$n ${filter.getOrElse(entity)}(s) in the registry.", Some(n)))
            case NlQueryService.ListIntent(category) =>
              NlQueryRepo.listAssets(category).map { rows =>
                val noun = category.getOrElse("asset")
                if (rows.isEmpty) ok(prompt, "list", s"No $noun found in the registry.", Some(0L))
                else {
                  val items = rows.map { case (title, maker, cat) =>
                    NlItem(
                      title,
                      List(maker, cat).flatten.distinct.mkString(" · ") match { case "" => None; case s => Some(s) }
                    )
                  }
                  okItems(prompt, "list", s"You own ${rows.size} $noun${if (rows.size == 1) "" else "s"}:", items)
                }
              }
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
            case NlQueryService.CategoryValueIntent(cat) =>
              NlQueryRepo.categoryValue(cat).map { case (sum, cnt) =>
                if (cnt == 0L) ok(prompt, "category_value", s"No $cat assets with a recorded value.", Some(0L))
                else
                  ok(
                    prompt,
                    "category_value",
                    s"Your $cat assets are worth ${gbp(sum)} ($cnt asset(s), acquisition value).",
                    Some(cnt)
                  )
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
            case NlQueryService.ServiceDueIntent(kw) =>
              if (kw.isEmpty) (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
              else
                NlQueryRepo.serviceDueForAsset(kw).map {
                  case Some((title, Some(due), vendor)) =>
                    val by = vendor.map(v => s" with $v").getOrElse("")
                    ok(prompt, "service_due", s"$title is next due a service on $due$by.", None)
                  case Some((title, None, _)) =>
                    ok(prompt, "service_due", s"$title has a service plan, but no date is scheduled yet.", None)
                  case None => ok(prompt, "service_due", s"""No service plan on record for "$kw".""", None)
                }
            case NlQueryService.InsuranceAmountIntent(kw) =>
              if (kw.isEmpty) (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
              else
                NlQueryRepo.insuranceForAsset(kw).map {
                  case Some((title, insured, value, insurer, renewal)) =>
                    if (!insured) ok(prompt, "insurance", s"$title is recorded as not currently insured.", None)
                    else {
                      val who = insurer.map(i => s" with $i").getOrElse("")
                      val cover = value.map(v => s" for ${gbp(v)} of cover").getOrElse("")
                      val ren = renewal.map(r => s", renewing $r").getOrElse("")
                      // the sum insured, not a premium — Kanzen stores cover, not what was paid
                      ok(prompt, "insurance", s"$title is insured$who$cover$ren.", value)
                    }
                  case None => ok(prompt, "insurance", s"""No insurance on record for "$kw".""", None)
                }
            case NlQueryService.LastActivityIntent(kw) =>
              if (kw.isEmpty) (Left(cannot): Out[QueryResult]).pure[ConnectionIO]
              else
                NlQueryRepo.lastActivityForPerson(NlQueryService.stem(kw)).map {
                  case Some((title, date, isPast)) =>
                    val rel = if (isPast) s"last on record $date" else s"next scheduled $date"
                    ok(prompt, "last_activity", s"$title — $rel.", None)
                  case None => ok(prompt, "last_activity", s"""No calendar activity matching "$kw".""", None)
                }
            case NlQueryService.Unknown(_) =>
              // No structured intent — fall back to RAG retrieval over the indexed entity documents (NL-2).
              // Sandbox returns the best-matching document as a titled item + a clean extract; prod synthesises
              // over the top-K via Claude. The stored body repeats the title + is FTS-shaped, so strip the
              // leading "Title." echo and surface the title as the item heading rather than inlining it.
              EntityDocRepo.search(prompt, 3).map {
                case Nil => Left(cannot)
                case best :: _ =>
                  val body = best.body.stripPrefix(best.title).stripPrefix(".").stripPrefix(":").trim
                  okItems(prompt, "rag", best.title, List(NlItem(best.title, Some(snippet(body)))))
              }
          }).transact(xa)
        }
    }

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
