package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.insights.InsightsRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F29 — aggregate registry reporting (Principal-private): value-by-category, top assets and lifetime spend, all
  * computed from the real registry (no synthesised figures). Pairs with F23 registry-health on the Insights surface.
  */
object Insights {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class CategorySpend(category: String, totalMinor: Long)
  final case class TopAsset(title: String, maker: Option[String], valueMinor: Long)
  final case class SpendPoint(month: String, currency: String, totalMinor: Long)
  final case class RegistryAnalytics(
      assetTotal: Long,
      lifetimeSpendMinor: Long,
      byCategory: List[CategorySpend],
      topAssets: List[TopAsset],
      spendByMonth: List[SpendPoint]
  )

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access"))

  def analytics(xa: Transactor[IO], p: Principal): IO[Out[RegistryAnalytics]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { a =>
        if (!a.can(Actions.byKey("asset:view"))) (Left(forbidden): Out[RegistryAnalytics]).pure[ConnectionIO]
        else
          for {
            total <- InsightsRepo.assetTotal
            spend <- InsightsRepo.lifetimeSpendMinor
            byCat <- InsightsRepo.valueByCategory
            top <- InsightsRepo.topAssets(6)
            trend <- InsightsRepo.spendByMonth
          } yield Right(
            RegistryAnalytics(
              total,
              spend,
              byCat.map { case (c, t) => CategorySpend(c, t) },
              top.map { case (title, maker, v) => TopAsset(title, maker, v) },
              trend.map { case (m, ccy, t) => SpendPoint(m, ccy, t) }
            )
          ): Out[RegistryAnalytics]
      }
      .transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])

  val analyticsEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), RegistryAnalytics, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "insights" / "registry-analytics")
      .errorOut(err)
      .out(jsonBody[RegistryAnalytics])
      .summary("Registry analytics: value-by-category, top assets, lifetime spend (Principal-only)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    analyticsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => analytics(xa, p))
  )

  val endpoints: List[AnyEndpoint] = List(analyticsEndpoint)
}
