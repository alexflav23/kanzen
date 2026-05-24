package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.fx.{Currency, FxRepo, FxService}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate

/** F37 — currencies & FX overlay. Native amounts are the truth; this layer reads daily
  * snapshots and converts at the rate on a chosen date (default today), **always labelled**
  * with the rate basis. Cross pairs triangulate via the base (GBP). Rollups return a
  * per-currency breakdown (native = primary) plus a single dated-estimate total. */
object Fx {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class CurrencyView(code: String, symbol: Option[String], decimals: Int)
  final case class ConvertReq(amountMinor: Long, from: String, to: String, on: Option[LocalDate])
  final case class Conversion(amountMinor: Long, from: String, convertedMinor: Long, to: String, rate: Double, asOf: LocalDate, label: String)
  final case class Line(currency: String, amountMinor: Long)
  final case class BreakdownRow(currency: String, nativeMinor: Long, convertedMinor: Long, rate: Double)
  final case class RollupReq(target: String, on: Option[LocalDate], lines: List[Line])
  final case class Rollup(target: String, totalMinor: Long, asOf: LocalDate, label: String, breakdown: List[BreakdownRow], unconvertible: List[String])

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private val noRate: (StatusCode, ApiError) = (StatusCode.UnprocessableEntity, ApiError(422, "no_rate", "No FX rate available for that pair/date."))

  private def gate[A](p: Principal)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.canRead("fx")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  private def label(rate: Double, on: LocalDate): String = f"≈ at $on rate (×$rate%.4f)"

  def currencies(xa: Transactor[IO], p: Principal): IO[Out[List[CurrencyView]]] =
    gate(p)(FxRepo.currencies.map(_.map((c: Currency) => CurrencyView(c.code, c.symbol, c.decimals)))).transact(xa)

  def convert(xa: Transactor[IO], p: Principal, r: ConvertReq): IO[Out[Conversion]] = {
    val on = r.on.getOrElse(LocalDate.now())
    Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("fx")) (Left(forbidden): Out[Conversion]).pure[ConnectionIO]
      else FxRepo.crossRateOn(r.from, r.to, on).map {
        case None       => Left(noRate)
        case Some(rate) => Right(Conversion(r.amountMinor, r.from, FxService.convertMinor(r.amountMinor, rate), r.to, rate, on, label(rate, on)))
      }
    }.transact(xa)
  }

  def rollup(xa: Transactor[IO], p: Principal, r: RollupReq): IO[Out[Rollup]] = {
    val on = r.on.getOrElse(LocalDate.now())
    Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("fx")) (Left(forbidden): Out[Rollup]).pure[ConnectionIO]
      else {
        // group native amounts by currency (per-currency breakdown is the primary truth)
        val byCcy = r.lines.groupMapReduce(_.currency)(_.amountMinor)(_ + _)
        byCcy.toList.traverse { case (ccy, native) =>
          FxRepo.crossRateOn(ccy, r.target, on).map(rate => (ccy, native, rate))
        }.map { rows =>
          val converted = rows.collect { case (c, n, Some(rate)) => BreakdownRow(c, n, FxService.convertMinor(n, rate), rate) }
          val missing   = rows.collect { case (c, _, None) => c }
          val total     = converted.map(_.convertedMinor).sum
          Right(Rollup(r.target, total, on, s"≈ ${r.target} dated estimate at $on rate", converted.sortBy(_.currency), missing)): Out[Rollup]
        }
      }
    }.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val currenciesEndpoint = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "currencies").errorOut(err).out(jsonBody[List[CurrencyView]]).summary("Active currencies")
  val convertEndpoint    = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "fx" / "convert").in(jsonBody[ConvertReq]).errorOut(err).out(jsonBody[Conversion]).summary("Convert an amount at the rate on a date")
  val rollupEndpoint     = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "fx" / "rollup").in(jsonBody[RollupReq]).errorOut(err).out(jsonBody[Rollup]).summary("Roll multi-currency lines up to a target (with per-currency breakdown)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    currenciesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => currencies(xa, p)),
    convertEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ConvertReq) => convert(xa, p, r)),
    rollupEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: RollupReq) => rollup(xa, p, r)),
  )

  val endpoints: List[AnyEndpoint] = List(currenciesEndpoint, convertEndpoint, rollupEndpoint)
}
