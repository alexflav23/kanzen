package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.calendar.{CalEvent, CalendarRepo}
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
      category: String,
      source: String,
      readOnly: Boolean
  )
  final case class CreateReq(title: String, on: LocalDate, category: Option[String], propertyId: Option[UUID])
  final case class UpdateReq(title: String, on: LocalDate, category: String)
  final case class Ok(ok: Boolean)

  // task/maintenance overlays are derived (read-only); native calendar rows are editable
  private def ev(c: CalEvent): EventView = EventView(
    c.id,
    c.title,
    c.startOn,
    c.category,
    c.source,
    readOnly = c.source == "task" || c.source == "maintenance"
  )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to calendar"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such event."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(a =>
        if (a.canRead("calendar")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )
  private def write[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(a =>
        if (a.can(Level.Write, "calendar")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  def events(
      xa: Transactor[IO],
      p: Principal,
      from: LocalDate,
      to: LocalDate,
      category: Option[String]
  ): IO[Out[List[EventView]]] =
    read(p, CalendarRepo.merged(from, to).map(_.map(ev).filter(e => category.forall(_ == e.category)))).transact(xa)

  def create(xa: Transactor[IO], p: Principal, r: CreateReq): IO[Out[EventView]] = {
    val cat = r.category.getOrElse("manual")
    if (r.title.trim.isEmpty) IO.pure(Left(badReq("title required")))
    else if (!CATEGORIES.contains(cat)) IO.pure(Left(badReq(s"category must be one of ${CATEGORIES.mkString(", ")}")))
    else
      write(
        p,
        CalendarRepo
          .createNative(p.userId, r.title, r.on, cat, r.propertyId, "manual", None)
          .map(id => EventView(id, r.title, Some(r.on), cat, "manual", readOnly = false))
      ).transact(xa)
  }

  def update(xa: Transactor[IO], p: Principal, id: UUID, r: UpdateReq): IO[Out[Ok]] = {
    val tx = for {
      a <- Authz.authorizer(p.role)
      exists <- CalendarRepo.exists(id)
      res <-
        if (!a.can(Level.Write, "calendar")) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Ok]).pure[ConnectionIO]
        else CalendarRepo.update(id, r.title, r.on, r.category).map(n => Right(Ok(n > 0)): Out[Ok])
    } yield res
    tx.transact(xa)
  }

  def delete(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    write(p, CalendarRepo.softDelete(id).map(n => Ok(n > 0))).transact(xa)

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

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    eventsEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (from, to, cat) => events(xa, p, from, to, cat) }),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    updateEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => update(xa, p, id, r) }),
    deleteEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => delete(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(eventsEndpoint, createEndpoint, updateEndpoint, deleteEndpoint)
}
