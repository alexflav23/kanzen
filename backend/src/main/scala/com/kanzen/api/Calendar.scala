package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Action, Actions, Authz}
import com.kanzen.calendar.{CalEvent, CalendarFeed, CalendarRepo}
import com.kanzen.events.{Actor, DomainWriter, Events, Subject}
import com.kanzen.identity.UserRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.{LocalDate, LocalTime}
import java.util.UUID

/** F07 — household calendar. Native event authoring + a merged view that overlays read-only task due-dates (F06) and
  * maintenance plans (F11). Two-way Google sync is an external adapter (deferred to hardening); the idempotent
  * google_event_id upsert is the sync seam.
  */
object Calendar {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val CATEGORIES = Set("delivery", "maintenance", "booking", "hr", "finance", "manual", "task")

  final case class EventView(
      id: UUID,
      title: String,
      startOn: Option[LocalDate],
      startTime: Option[LocalTime],
      endTime: Option[LocalTime],
      category: String,
      source: String,
      readOnly: Boolean
  )
  final case class CreateReq(
      title: String,
      on: LocalDate,
      category: Option[String],
      propertyId: Option[UUID],
      startTime: Option[LocalTime],
      endTime: Option[LocalTime]
  )
  final case class UpdateReq(
      title: String,
      on: LocalDate,
      category: String,
      startTime: Option[LocalTime],
      endTime: Option[LocalTime]
  )
  final case class Ok(ok: Boolean)
  // F07 iCal — the relative feed path the web turns into an absolute (webcal) subscribe URL.
  final case class FeedUrl(path: String)

  // task/maintenance overlays are derived (read-only); native calendar rows are editable
  private def ev(c: CalEvent): EventView = EventView(
    c.id,
    c.title,
    c.startOn,
    c.startTime,
    c.endTime,
    c.category,
    c.source,
    readOnly = c.source == "task" || c.source == "maintenance"
  )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to calendar"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such event."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  // F02 v2 — calendar actions.
  private val viewA = Actions.byKey("calendar:view")
  private val editA = Actions.byKey("calendar:edit")
  private val createA = Actions.byKey("calendar:create")

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(viewA)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A], action: Action = editA): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(action)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  def events(
      xa: Transactor[IO],
      p: Principal,
      from: LocalDate,
      to: LocalDate,
      category: Option[String]
  ): IO[Out[List[EventView]]] =
    read(p, CalendarRepo.merged(p.tenantId, from, to).map(_.map(ev).filter(e => category.forall(_ == e.category))))
      .transact(xa)

  def create(xa: Transactor[IO], p: Principal, r: CreateReq): IO[Out[EventView]] = {
    val cat = r.category.getOrElse("manual")
    if (r.title.trim.isEmpty) IO.pure(Left(badReq("title required")))
    else if (!CATEGORIES.contains(cat)) IO.pure(Left(badReq(s"category must be one of ${CATEGORIES.mkString(", ")}")))
    else {
      // F34 — audit + emit `calendar_event.created` alongside the row insert (single tx).
      val mkRow = DomainWriter.write(
        actor = Actor.user(p.userId),
        action = "calendar.create",
        eventType = Events.Calendar.Created,
        ownerId = p.userId,
        propertyId = r.propertyId
      )(
        CalendarRepo.createNative(
          p.userId,
          p.tenantId,
          r.title,
          r.on,
          cat,
          r.propertyId,
          "manual",
          None,
          r.startTime,
          r.endTime
        )
      )(
        subjectOf = id => Subject("calendar_event", id),
        payloadOf = id =>
          Json.obj(
            "id" -> id.asJson,
            "title" -> r.title.asJson,
            "on" -> r.on.toString.asJson,
            "category" -> cat.asJson,
            "startTime" -> r.startTime.map(_.toString).asJson,
            "endTime" -> r.endTime.map(_.toString).asJson
          )
      )
      write(
        p,
        mkRow.map(id => EventView(id, r.title, Some(r.on), r.startTime, r.endTime, cat, "manual", readOnly = false)),
        createA
      ).transact(xa)
    }
  }

  def update(xa: Transactor[IO], p: Principal, id: UUID, r: UpdateReq): IO[Out[Ok]] = {
    val tx = for {
      a <- Authz.forUser(p.userId, p.role)
      exists <- CalendarRepo.exists(id, p.tenantId)
      res <-
        if (!a.can(editA)) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Ok]).pure[ConnectionIO]
        else
          DomainWriter
            .write(
              actor = Actor.user(p.userId),
              action = "calendar.update",
              eventType = Events.Calendar.Updated,
              ownerId = p.userId
            )(
              CalendarRepo.update(id, p.tenantId, r.title, r.on, r.category, r.startTime, r.endTime).map(n => Ok(n > 0))
            )(
              subjectOf = _ => Subject("calendar_event", id),
              payloadOf = _ =>
                Json.obj(
                  "id" -> id.asJson,
                  "title" -> r.title.asJson,
                  "on" -> r.on.toString.asJson,
                  "category" -> r.category.asJson,
                  "startTime" -> r.startTime.map(_.toString).asJson,
                  "endTime" -> r.endTime.map(_.toString).asJson
                )
            )
            .map(ok => Right(ok): Out[Ok])
    } yield res
    tx.transact(xa)
  }

  def delete(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    write(
      p,
      DomainWriter.write(
        actor = Actor.user(p.userId),
        action = "calendar.delete",
        eventType = Events.Calendar.Deleted,
        ownerId = p.userId
      )(CalendarRepo.softDelete(id, p.tenantId).map(n => Ok(n > 0)))(
        subjectOf = _ => Subject("calendar_event", id),
        payloadOf = _ => Json.obj("id" -> id.asJson)
      )
    ).transact(xa)

  // F07 iCal — mint this subscriber's signed feed path. Requires calendar:view (they must be able to read the calendar).
  def feedUrl(xa: Transactor[IO], secret: String, p: Principal): IO[Out[FeedUrl]] =
    Authz
      .forUser(p.userId, p.role)
      .transact(xa)
      .flatMap { authz =>
        if (!authz.can(viewA)) IO.pure(Left(forbidden))
        else
          IO.realTimeInstant.map { now =>
            val token = CalendarFeed.tokenFor(p.tenantId, p.userId, secret, now.getEpochSecond)
            Right(FeedUrl(s"/api/calendar/feed/$token.ics"))
          }
      }

  // F07 iCal — the public, token-authed feed. No bearer (a calendar client can't send one): the token IS the capability.
  // We re-resolve the subscriber's role + tenant and apply the same calendar:view gate + tenant filter as the app, so
  // the feed never leaks more than the in-app calendar would. A bad/expired/tampered token → 404 (no existence probe).
  def feed(xa: Transactor[IO], secret: String, token: String): IO[Either[StatusCode, (String, String)]] =
    IO.realTimeInstant.flatMap { now =>
      // the .ics suffix is cosmetic (so clients treat it as a calendar) — strip it before verifying.
      val raw = if (token.endsWith(".ics")) token.dropRight(4) else token
      CalendarFeed.parse(raw, secret, now.getEpochSecond) match {
        case None => IO.pure(Left(StatusCode.NotFound))
        case Some((tenantId, userId)) =>
          val today = LocalDate.now()
          val from = today.minusDays(30)
          val to = today.plusDays(180)
          val tx: ConnectionIO[Either[StatusCode, List[com.kanzen.calendar.CalEvent]]] =
            UserRepo.findById(userId).flatMap {
              case Some(u) if u.tenantId == tenantId =>
                Authz.forUser(u.id, u.role).flatMap { authz =>
                  if (!authz.can(viewA))
                    (Left(StatusCode.NotFound): Either[StatusCode, List[com.kanzen.calendar.CalEvent]])
                      .pure[ConnectionIO]
                  else CalendarRepo.merged(tenantId, from, to).map(Right(_))
                }
              case _ =>
                (Left(StatusCode.NotFound): Either[StatusCode, List[com.kanzen.calendar.CalEvent]]).pure[ConnectionIO]
            }
          tx.transact(xa).map {
            case Left(sc) => Left(sc)
            case Right(events) =>
              val entries = events.collect {
                case c if c.startOn.isDefined =>
                  CalendarFeed.Entry(c.id, c.title, c.startOn.get, c.startTime, c.endTime, c.category)
              }
              Right(("text/calendar; charset=utf-8", CalendarFeed.ics("Kanzen — Household Calendar", entries, now)))
          }
      }
    }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val eventsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "calendar" / "events")
    .in(query[LocalDate]("from"))
    .in(query[LocalDate]("to"))
    .in(query[Option[String]]("category"))
    .errorOut(err)
    .out(jsonBody[List[EventView]])
    .summary("Merged calendar (events + task & maintenance overlay)")
  val createEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "calendar" / "events")
    .in(jsonBody[CreateReq])
    .errorOut(err)
    .out(jsonBody[EventView])
    .summary("Create a calendar event")
  val updateEndpoint = sttp.tapir.endpoint.patch
    .securityIn(bearer)
    .in("api" / "calendar" / "events" / path[UUID]("id"))
    .in(jsonBody[UpdateReq])
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Edit a calendar event")
  val deleteEndpoint = sttp.tapir.endpoint.delete
    .securityIn(bearer)
    .in("api" / "calendar" / "events" / path[UUID]("id"))
    .errorOut(err)
    .out(jsonBody[Ok])
    .summary("Delete a calendar event")

  val feedUrlEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "calendar" / "feed-url")
    .errorOut(err)
    .out(jsonBody[FeedUrl])
    .summary("Mint this subscriber's signed iCal feed path (subscribe from iOS/Android/Google)")

  val feedEndpoint = sttp.tapir.endpoint.get
    .in("api" / "calendar" / "feed" / path[String]("token"))
    .out(header[String](sttp.model.HeaderNames.ContentType))
    .out(stringBody)
    .errorOut(statusCode)
    .summary("Public read-only iCal subscription feed (the token is the capability — no bearer)")

  def serverEndpoints(a: Auth, xa: Transactor[IO], feedSecret: String): List[ServerEndpoint[Any, IO]] = List(
    eventsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (from, to, cat) => events(xa, p, from, to, cat) }),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    updateEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => update(xa, p, id, r) }),
    deleteEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => delete(xa, p, id)),
    feedUrlEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => feedUrl(xa, feedSecret, p))
  )

  /** The public (token-authed) feed — wired into the unsecured route group. */
  def publicServerEndpoints(xa: Transactor[IO], feedSecret: String): List[ServerEndpoint[Any, IO]] =
    List(feedEndpoint.serverLogic(token => feed(xa, feedSecret, token)))

  val endpoints: List[AnyEndpoint] =
    List(eventsEndpoint, createEndpoint, updateEndpoint, deleteEndpoint, feedUrlEndpoint, feedEndpoint)
}
