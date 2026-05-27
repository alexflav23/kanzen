package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.wealth.{Holding, InvestmentRepo, InvestmentService, Security}
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
import java.util.UUID

/** F40 — investments & securities: cost-basis lots, a price database, holdings valuation with unrealised gains, and
  * FIFO sells with realised gains. **Records investments, never executes trades.** Principal-private.
  */
object Investments {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class SecurityView(id: UUID, symbol: String, name: String, currency: String, assetClass: String)
  final case class CreateSecurityReq(symbol: String, name: String, currency: Option[String], assetClass: Option[String])
  final case class PriceReq(priceMinor: Long, asOf: Option[LocalDate])
  final case class BuyReq(
      entityId: UUID,
      securityId: UUID,
      quantity: Double,
      costBasisMinor: Long,
      acquiredOn: Option[LocalDate]
  )
  final case class SellReq(
      entityId: UUID,
      securityId: UUID,
      quantity: Double,
      proceedsMinor: Long,
      on: Option[LocalDate]
  )
  final case class SellResult(quantitySold: Double, proceedsMinor: Long, costBasisMinor: Long, realizedGainMinor: Long)
  final case class HoldingView(
      securityId: UUID,
      symbol: String,
      quantity: Double,
      costBasisMinor: Long,
      marketValueMinor: Long,
      unrealizedGainMinor: Long
  )
  final case class Ok(id: UUID)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Private Wealth is Principal-only"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such security."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private def conflict(m: String): (StatusCode, ApiError) = (StatusCode.Conflict, ApiError(409, "conflict", m))

  private def sv(s: Security): SecurityView = SecurityView(s.id, s.symbol, s.name, s.currency, s.assetClass)
  private def hv(h: Holding): HoldingView =
    HoldingView(h.securityId, h.symbol, h.quantity, h.costBasisMinor, h.marketValueMinor, h.unrealizedGainMinor)

  private def principal[A](p: Principal)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a =>
        if (a.can(Level.Admin, "wealth")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  def securities(xa: Transactor[IO], p: Principal): IO[Out[List[SecurityView]]] =
    principal(p)(InvestmentRepo.securities.map(_.map(sv))).transact(xa)
  def createSecurity(xa: Transactor[IO], p: Principal, r: CreateSecurityReq): IO[Out[SecurityView]] =
    if (r.symbol.trim.isEmpty) IO.pure(Left(badReq("symbol required")))
    else
      principal(p)(
        InvestmentRepo
          .createSecurity(r.symbol, r.name, r.currency.getOrElse("GBP"), r.assetClass.getOrElse("equity"))
          .map(id => SecurityView(id, r.symbol, r.name, r.currency.getOrElse("GBP"), r.assetClass.getOrElse("equity")))
      ).transact(xa)

  def setPrice(xa: Transactor[IO], p: Principal, securityId: UUID, r: PriceReq): IO[Out[Ok]] = {
    val tx = for {
      a <- Authz.forUser(p.userId, p.role)
      exists <- InvestmentRepo.securityExists(securityId)
      res <-
        if (!a.can(Level.Admin, "wealth")) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Ok]).pure[ConnectionIO]
        else
          InvestmentRepo
            .setPrice(securityId, r.priceMinor, r.asOf.getOrElse(LocalDate.now()))
            .as(Right(Ok(securityId)): Out[Ok])
    } yield res
    tx.transact(xa)
  }

  def buy(xa: Transactor[IO], p: Principal, r: BuyReq): IO[Out[Ok]] =
    if (r.quantity <= 0) IO.pure(Left(badReq("quantity must be > 0")))
    else
      principal(p)(
        InvestmentRepo
          .buy(
            p.userId,
            r.entityId,
            r.securityId,
            r.quantity,
            r.costBasisMinor,
            r.acquiredOn.getOrElse(LocalDate.now())
          )
          .map(Ok)
      ).transact(xa)

  /** FIFO sell across open lots → realised gain = proceeds − cost of the closed quantity. */
  def sell(xa: Transactor[IO], p: Principal, r: SellReq): IO[Out[SellResult]] = {
    if (r.quantity <= 0) IO.pure(Left(badReq("quantity must be > 0")))
    else {
      val tx = for {
        a <- Authz.forUser(p.userId, p.role)
        lots <- InvestmentRepo.openLots(r.entityId, r.securityId)
        res <-
          if (!a.can(Level.Admin, "wealth")) (Left(forbidden): Out[SellResult]).pure[ConnectionIO]
          else {
            val available = lots.map(_.quantity).sum
            if (available + 1e-9 < r.quantity)
              (Left(conflict(s"only $available units held")): Out[SellResult]).pure[ConnectionIO]
            else {
              val allocations = InvestmentService.fifoClose(lots, r.quantity)
              val on = r.on.getOrElse(LocalDate.now())
              allocations
                .traverse { case (lotId, qtyClosed, costClosed) =>
                  val proceedsForQty = math.round(r.proceedsMinor * (qtyClosed / r.quantity))
                  val gain = proceedsForQty - costClosed
                  InvestmentRepo.closeLot(lotId, qtyClosed, proceedsForQty, gain, on).as((qtyClosed, costClosed, gain))
                }
                .map { parts =>
                  val cost = parts.map(_._2).sum
                  val gain = parts.map(_._3).sum
                  Right(SellResult(r.quantity, r.proceedsMinor, cost, gain)): Out[SellResult]
                }
            }
          }
      } yield res
      tx.transact(xa)
    }
  }

  def holdings(xa: Transactor[IO], p: Principal, entity: Option[UUID]): IO[Out[List[HoldingView]]] =
    principal(p)(InvestmentRepo.holdings(p.userId, entity).map(_.map(hv))).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val securitiesEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "investments" / "securities")
    .errorOut(err)
    .out(jsonBody[List[SecurityView]])
    .summary("Securities")
  val createSecEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "investments" / "securities")
    .in(jsonBody[CreateSecurityReq])
    .errorOut(err)
    .out(jsonBody[SecurityView])
    .summary("Add a security")
  val priceEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "investments" / "securities" / path[UUID]("id") / "price")
    .in(jsonBody[PriceReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Record a price")
  val buyEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "investments" / "lots")
    .in(jsonBody[BuyReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Buy (open a cost-basis lot)")
  val sellEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "investments" / "sell")
    .in(jsonBody[SellReq])
    .errorOut(err)
    .out(jsonBody[SellResult])
    .summary("Sell (FIFO close → realised gain)")
  val holdingsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "investments" / "holdings")
    .in(query[Option[UUID]]("entity"))
    .errorOut(err)
    .out(jsonBody[List[HoldingView]])
    .summary("Holdings (market value + unrealised gain)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    securitiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => securities(xa, p)),
    createSecEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateSecurityReq) => createSecurity(xa, p, r)),
    priceEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => setPrice(xa, p, id, r) }),
    buyEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: BuyReq) => buy(xa, p, r)),
    sellEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SellReq) => sell(xa, p, r)),
    holdingsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (e: Option[UUID]) => holdings(xa, p, e))
  )

  val endpoints: List[AnyEndpoint] =
    List(securitiesEndpoint, createSecEndpoint, priceEndpoint, buyEndpoint, sellEndpoint, holdingsEndpoint)
}
