package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.maintenance.{MaintenanceRepo, MaintenanceService, PlanRow}
import com.kanzen.property.PropertyRepo
import com.kanzen.tasks.TaskRepo
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F11 — maintenance plans + reminder engine. Completing a service rolls `next_due` forward by frequency and logs it;
  * `dueSoon` flags plans within their lead window. Operational: Manager writes, Staff read, Principal admin.
  */
object Maintenance {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class PlanView(
      id: UUID,
      title: Option[String],
      frequency: String,
      nextDue: Option[LocalDate],
      vendor: Option[String],
      dueSoon: Boolean,
      propertyId: Option[UUID]
  )
  final case class CreateReq(
      title: String,
      propertyId: Option[UUID],
      vendor: Option[String],
      frequency: String,
      firstDue: LocalDate,
      leadDays: Option[Int]
  )
  final case class CompleteReq(performedOn: Option[LocalDate], costMinor: Option[Long])
  final case class CompleteResult(nextDue: LocalDate)

  private def view(p: PlanRow, today: LocalDate): PlanView =
    PlanView(
      p.id,
      p.title,
      p.frequency,
      p.nextDue,
      p.vendor,
      p.nextDue.exists(d => MaintenanceService.dueSoon(d, today, p.leadDays)),
      p.propertyId
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to maintenance"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such plan."))
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  /** F11 — the task spawned from a plan (in the property's task project, due on the plan's next_due). */
  final case class SpawnResult(taskId: UUID, dueOn: Option[LocalDate])

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[PlanView]]] = {
    val today = LocalDate.now()
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("maintenance:view"))) (Left(forbidden): Out[List[PlanView]]).pure[ConnectionIO]
      else MaintenanceRepo.list.map(ps => Right(ps.map(view(_, today))): Out[List[PlanView]])
    }
    tx.transact(xa)
  }

  def create(xa: Transactor[IO], p: Principal, r: CreateReq): IO[Out[PlanView]] = {
    val today = LocalDate.now()
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("maintenance:create"))) (Left(forbidden): Out[PlanView]).pure[ConnectionIO]
      else
        MaintenanceRepo
          .insert(p.userId, r.title, r.propertyId, r.vendor, r.frequency, r.firstDue, r.leadDays.getOrElse(5))
          .flatMap(pl =>
            EventRepo
              .emit(
                Envelope(
                  Events.Maintenance.Scheduled,
                  Actor.user(p.userId),
                  Subject("maintenance", pl.id),
                  p.userId,
                  r.propertyId,
                  Json.obj("title" -> r.title.asJson, "frequency" -> r.frequency.asJson)
                )
              )
              .as(Right(view(pl, today)): Out[PlanView])
          )
    }
    tx.transact(xa)
  }

  def complete(xa: Transactor[IO], p: Principal, id: UUID, r: CompleteReq): IO[Out[CompleteResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- MaintenanceRepo.exists(id)
      res <-
        if (!authz.can(Actions.byKey("maintenance:edit"))) (Left(forbidden): Out[CompleteResult]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[CompleteResult]).pure[ConnectionIO]
        else
          MaintenanceRepo
            .complete(id, r.performedOn.getOrElse(LocalDate.now()), r.costMinor)
            .flatMap(nd =>
              EventRepo
                .emit(
                  Envelope(
                    Events.Maintenance.Completed,
                    Actor.user(p.userId),
                    Subject("maintenance", id),
                    p.userId,
                    None,
                    Json.obj("nextDue" -> nd.toString.asJson)
                  )
                )
                .as(Right(CompleteResult(nd)): Out[CompleteResult])
            )
    } yield res
    tx.transact(xa)
  }

  /** Spawn a task from a plan into the plan's property task project, due on next_due (Manager+; F11). The task lands on
    * the Calendar via its due date (the plan's own next_due also overlays read-only).
    */
  def spawnTask(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[SpawnResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      plan <- MaintenanceRepo.findRow(id)
      res <-
        if (!authz.can(Actions.byKey("maintenance:edit"))) (Left(forbidden): Out[SpawnResult]).pure[ConnectionIO]
        else
          plan match {
            case None => (Left(notFound): Out[SpawnResult]).pure[ConnectionIO]
            case Some(pl) =>
              pl.propertyId match {
                case None =>
                  (Left(badReq("plan has no property — can't route a task")): Out[SpawnResult]).pure[ConnectionIO]
                case Some(propId) =>
                  PropertyRepo.taskProjectId(propId).flatMap {
                    case None =>
                      (Left(badReq("this property has no linked task project")): Out[SpawnResult]).pure[ConnectionIO]
                    case Some(projId) =>
                      TaskRepo
                        .createTask(p.tenantId, projId, pl.title.getOrElse("Maintenance"), pl.nextDue, None)
                        .map(t => Right(SpawnResult(t.id, pl.nextDue)): Out[SpawnResult])
                  }
              }
          }
    } yield res
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val listEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "maintenance")
    .errorOut(err)
    .out(jsonBody[List[PlanView]])
    .summary("Maintenance plans (with due-soon)")
  val createEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "maintenance")
    .in(jsonBody[CreateReq])
    .errorOut(err)
    .out(jsonBody[PlanView])
    .summary("Create a plan (Manager+)")
  val completeEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "maintenance" / path[UUID]("id") / "complete")
    .in(jsonBody[CompleteReq])
    .errorOut(err)
    .out(jsonBody[CompleteResult])
    .summary("Log a service + roll next_due forward")

  val spawnTaskEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "maintenance" / path[UUID]("id") / "task")
    .errorOut(err)
    .out(jsonBody[SpawnResult])
    .summary("Spawn a task from a plan into the property's task project, due on next_due (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    completeEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => complete(xa, p, id, r) }),
    spawnTaskEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => spawnTask(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(listEndpoint, createEndpoint, completeEndpoint, spawnTaskEndpoint)
}
