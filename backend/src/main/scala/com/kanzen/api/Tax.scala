package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.finance.{ExpenseRepo, TaxService}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F38 — tax/VAT/deductibility estimation. Estimation only — Kanzen never files or pays. Principal-private (gated on
  * `ledger`, which is Manager/Staff-denied).
  */
object Tax {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class IncomeEstimate(grossMinor: Long, estimatedTaxMinor: Long, takeHomeMinor: Long, effectiveRatePct: Int)
  final case class DeductibleReport(deductibleTotalMinor: Long, vatReclaimableTotalMinor: Long, deductibleCount: Int)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "tax estimates are Principal-only"))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  /** Pure estimate; only the authz check touches the DB. */
  def incomeEstimate(xa: Transactor[IO], p: Principal, grossMinor: Long): IO[Out[IncomeEstimate]] = {
    if (grossMinor < 0L) IO.pure(Left(badReq("income must be ≥ 0")))
    else
      Authz
        .forUser(p.userId, p.role)
        .map { authz =>
          if (!authz.can(Actions.byKey("ledger:view"))) Left(forbidden)
          else {
            val tax = TaxService.estimateIncomeTaxMinor(grossMinor)
            Right(IncomeEstimate(grossMinor, tax, grossMinor - tax, TaxService.effectiveRatePct(grossMinor)))
          }
        }
        .transact(xa)
  }

  def deductibleReport(xa: Transactor[IO], p: Principal): IO[Out[DeductibleReport]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      summary <-
        if (authz.can(Actions.byKey("ledger:view"))) ExpenseRepo.deductibleSummary else (0L, 0L, 0).pure[ConnectionIO]
    } yield
      if (!authz.can(Actions.byKey("ledger:view"))) Left(forbidden)
      else Right(DeductibleReport(summary._1, summary._2, summary._3))
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val incomeEndpoint: Endpoint[String, Long, (StatusCode, ApiError), IncomeEstimate, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "tax" / "income-estimate")
      .in(query[Long]("income"))
      .errorOut(err)
      .out(jsonBody[IncomeEstimate])
      .summary("Estimated UK income tax for a gross amount (Principal-only; estimate only)")

  val deductibleEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), DeductibleReport, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "tax" / "deductible-report")
      .errorOut(err)
      .out(jsonBody[DeductibleReport])
      .summary("Deductible + VAT-reclaimable totals across approved expenses (Principal-only)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    incomeEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (income: Long) => incomeEstimate(xa, p, income)),
    deductibleEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => deductibleReport(xa, p))
  )

  val endpoints: List[AnyEndpoint] = List(incomeEndpoint, deductibleEndpoint)
}
