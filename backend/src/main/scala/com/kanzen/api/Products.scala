package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.product.{Product, ProductRepo, ProductService}
import com.kanzen.replenishment.ReplenishmentService
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
import scala.util.Try

/** F35 products/stock + F36 predictive replenishment. Operational (Manager write, Staff
  * read). The forecast learns a product's purchase cadence and predicts run-out. */
object Products {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val STOCK = Set("in_stock", "low", "out")

  final case class ProductView(id: UUID, name: String, stockStatus: String, preferredSpec: Option[String], needsReorder: Boolean)
  final case class CreateReq(name: String, preferredSpec: Option[String], unit: Option[String])
  final case class StockReq(status: String)
  final case class ForecastReq(purchaseDates: List[String], leadDays: Option[Int])
  final case class ForecastResult(avgIntervalDays: Option[Double], predictedNext: Option[String], dueSoon: Boolean)

  private def pv(p: Product): ProductView = ProductView(p.id, p.name, p.stockStatus, p.preferredSpec, ProductService.needsReorder(p.stockStatus))

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to products"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such product."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[ProductView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("product")) (Left(forbidden): Out[List[ProductView]]).pure[ConnectionIO]
      else ProductRepo.list.map(ps => Right(ps.map(pv)): Out[List[ProductView]])
    }
    tx.transact(xa)
  }

  def reorder(xa: Transactor[IO], p: Principal): IO[Out[List[ProductView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { a =>
      if (!a.canRead("product")) (Left(forbidden): Out[List[ProductView]]).pure[ConnectionIO]
      else ProductRepo.needingReorder.map(ps => Right(ps.map(pv)): Out[List[ProductView]])
    }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, r: CreateReq): IO[Out[ProductView]] = {
    val tx = Authz.authorizer(p.role).flatMap { a =>
      if (!a.can(Level.Write, "product")) (Left(forbidden): Out[ProductView]).pure[ConnectionIO]
      else ProductRepo.insertOwned(p.userId, r.name, r.preferredSpec, r.unit).map(x => Right(pv(x)): Out[ProductView])
    }
    tx.transact(xa)
  }

  def setStock(xa: Transactor[IO], p: Principal, id: UUID, status: String): IO[Out[ProductView]] = {
    if (!STOCK.contains(status)) IO.pure(Left(badReq(s"status must be one of ${STOCK.mkString(", ")}")))
    else {
      val tx = for {
        authz  <- Authz.authorizer(p.role)
        exists <- ProductRepo.exists(id)
        res <-
          if (!authz.can(Level.Write, "product")) (Left(forbidden): Out[ProductView]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[ProductView]).pure[ConnectionIO]
          else ProductRepo.setStock(id, status) *> ProductRepo.list.map(_.find(_.id == id).map(pv).toRight(notFound))
      } yield res
      tx.transact(xa)
    }
  }

  /** F36 — given purchase history, predict the next purchase + flag if due within lead. */
  def forecast(xa: Transactor[IO], p: Principal, r: ForecastReq): IO[Out[ForecastResult]] = {
    val parsed = r.purchaseDates.flatMap(s => Try(LocalDate.parse(s)).toOption).sorted
    val tx = Authz.authorizer(p.role).map { a =>
      if (!a.canRead("product")) Left(forbidden)
      else {
        val avg = ReplenishmentService.avgIntervalDays(parsed)
        val predicted = for { last <- parsed.lastOption; d <- avg } yield ReplenishmentService.predictedNext(last, d)
        val due = predicted.exists(pd => ReplenishmentService.dueSoon(pd, LocalDate.now(), r.leadDays.getOrElse(7)))
        Right(ForecastResult(avg, predicted.map(_.toString), due))
      }
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val listEndpoint     = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "products").errorOut(err).out(jsonBody[List[ProductView]]).summary("Products (consumables) with stock status")
  val reorderEndpoint  = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "products" / "reorder").errorOut(err).out(jsonBody[List[ProductView]]).summary("Products needing reorder (low/out)")
  val createEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "products").in(jsonBody[CreateReq]).errorOut(err).out(jsonBody[ProductView]).summary("Add a product (Manager+)")
  val stockEndpoint    = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "products" / path[UUID]("id") / "stock").in(jsonBody[StockReq]).errorOut(err).out(jsonBody[ProductView]).summary("Set stock status")
  val forecastEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "products" / "forecast").in(jsonBody[ForecastReq]).errorOut(err).out(jsonBody[ForecastResult]).summary("F36 — predict next purchase from history")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    reorderEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => reorder(xa, p)),
    forecastEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ForecastReq) => forecast(xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    stockEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => setStock(xa, p, id, r.status) }),
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, reorderEndpoint, createEndpoint, stockEndpoint, forecastEndpoint)
}
