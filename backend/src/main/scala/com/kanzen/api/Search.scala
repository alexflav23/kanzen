package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authorizer, Authz}
import com.kanzen.search.{SearchHit, SearchRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F28 — full-text search + ⌘K. **Permission-filtered server-side**: a hit is only returned if the caller could read
  * that entity directly, so search can never leak an entity (e.g. an asset title) to a role that lacks access to it.
  */
object Search {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class Hit(entityType: String, entityId: UUID, title: String, subtitle: Option[String])
  final case class Results(query: String, hits: List[Hit])

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no search access"))

  /** The F02 resource a hit's entity type maps to; None ⇒ not searchable (deny by default). */
  private def resourceFor(entityType: String): Option[String] = entityType match {
    case "asset" => Some("asset")
    case "document" => Some("document")
    case "vendor" => Some("vendor")
    case "person" => Some("person")
    case "property" => Some("property")
    case "product" => Some("product")
    case _ => None
  }
  private def visible(a: Authorizer, entityType: String): Boolean =
    resourceFor(entityType).exists(r => a.canRead(r))

  def search(xa: Transactor[IO], p: Principal, q: String): IO[Out[Results]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap { a =>
        if (!a.can(Actions.byKey("search:view"))) (Left(forbidden): Out[Results]).pure[ConnectionIO]
        else
          SearchRepo.hits(q).map { hits =>
            val allowed = hits
              .filter(h => visible(a, h.entityType))
              .map((h: SearchHit) => Hit(h.entityType, h.entityId, h.title, h.subtitle))
            Right(Results(q, allowed)): Out[Results]
          }
      }
      .transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val searchEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "search")
    .in(query[String]("q"))
    .errorOut(err)
    .out(jsonBody[Results])
    .summary("Permission-filtered full-text search (⌘K)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    searchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (q: String) => search(xa, p, q))
  )

  val endpoints: List[AnyEndpoint] = List(searchEndpoint)
}
