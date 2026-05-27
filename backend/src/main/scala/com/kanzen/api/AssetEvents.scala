package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.asset.{AssetEvent, AssetEventRepo, AssetRepo}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
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

/** F19 — asset lifecycle events + timeline + lifetime-cost rollup. Reading the timeline needs registry read (`asset`);
  * logging an event needs `asset_event` write (Manager / maintenance / Principal). Events are append-only history.
  */
object AssetEvents {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val TYPES = Set(
    "acquired",
    "serviced",
    "cleaned",
    "repaired",
    "moved",
    "appraised",
    "sold",
    "gifted",
    "lost",
    "stolen",
    "lent",
    "returned",
    "inspected",
    "restored",
    "note"
  )

  final case class EventView(
      id: UUID,
      eventType: String,
      occurredAt: String,
      costMinor: Option[Long],
      currency: Option[String],
      note: Option[String],
      party: Option[String]
  )
  final case class Timeline(events: List[EventView], lifetimeCostMinor: Long)
  final case class LogReq(eventType: String, costMinor: Option[Long], currency: Option[String], note: Option[String])

  private def view(e: AssetEvent): EventView =
    EventView(e.id, e.eventType, e.occurredAt, e.costMinor, e.currency, e.note, e.party)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to asset events"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such asset."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def timeline(xa: Transactor[IO], p: Principal, assetId: UUID): IO[Out[Timeline]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      events <-
        if (authz.can(Actions.byKey("asset:view"))) AssetEventRepo.timeline(assetId)
        else List.empty[AssetEvent].pure[ConnectionIO]
      cost <-
        if (authz.can(Actions.byKey("asset:view"))) AssetEventRepo.lifetimeCostMinor(assetId) else 0L.pure[ConnectionIO]
    } yield if (!authz.can(Actions.byKey("asset:view"))) Left(forbidden) else Right(Timeline(events.map(view), cost))
    tx.transact(xa)
  }

  def log(xa: Transactor[IO], p: Principal, assetId: UUID, req: LogReq): IO[Out[EventView]] = {
    if (!TYPES.contains(req.eventType)) IO.pure(Left(badReq(s"type must be one of ${TYPES.mkString(", ")}")))
    else {
      val tx = for {
        authz <- Authz.forUser(p.userId, p.role)
        exists <- AssetRepo.exists(assetId)
        res <-
          if (!authz.can(Actions.byKey("asset_event:create"))) (Left(forbidden): Out[EventView]).pure[ConnectionIO]
          else if (!exists) (Left(notFound): Out[EventView]).pure[ConnectionIO]
          else
            AssetEventRepo
              .add(assetId, req.eventType, req.costMinor, req.currency, req.note)
              .map(e => Right(view(e)): Out[EventView])
      } yield res
      tx.transact(xa)
    }
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val timelineEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), Timeline, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "events")
      .errorOut(err)
      .out(jsonBody[Timeline])
      .summary("An asset's lifecycle timeline + lifetime cost")

  val logEndpoint: Endpoint[String, (UUID, LogReq), (StatusCode, ApiError), EventView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "assets" / path[UUID]("id") / "events")
      .in(jsonBody[LogReq])
      .errorOut(err)
      .out(jsonBody[EventView])
      .summary("Log a lifecycle event (Manager/maintenance+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    timelineEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => timeline(xa, p, id)),
    logEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => log(xa, p, id, r) })
  )

  val endpoints: List[AnyEndpoint] = List(timelineEndpoint, logEndpoint)
}
