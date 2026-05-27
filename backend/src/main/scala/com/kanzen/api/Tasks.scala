package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.events.{Actor, Envelope, EventRepo, Subject}
import com.kanzen.tasks.{TaskProject, TaskRepo, TaskRow}
import io.circe.Json
import io.circe.syntax._
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

/** F06 — native tasks + projects. Operational: Staff/Manager/Principal write; completing a recurring task spawns its
  * next occurrence.
  */
object Tasks {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ProjectView(id: UUID, name: String, propertyId: Option[UUID])
  final case class TaskView(
      id: UUID,
      projectId: Option[UUID],
      title: String,
      status: String,
      dueOn: Option[LocalDate],
      recurrence: Option[String]
  )
  final case class CreateProjectReq(name: String, propertyId: Option[UUID])
  final case class CreateTaskReq(projectId: UUID, title: String, dueOn: Option[LocalDate], recurrence: Option[String])
  final case class CompleteResult(completed: UUID, nextTaskId: Option[UUID])

  private def pv(p: TaskProject): ProjectView = ProjectView(p.id, p.name, p.propertyId)
  private def tv(t: TaskRow): TaskView = TaskView(t.id, t.projectId, t.title, t.status, t.dueOn, t.recurrence)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to tasks"))

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.canRead("task")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a =>
        if (a.can(Level.Write, "task")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  def projects(xa: Transactor[IO], p: Principal): IO[Out[List[ProjectView]]] =
    read(p, TaskRepo.listProjects.map(_.map(pv))).transact(xa)
  def createProject(xa: Transactor[IO], p: Principal, r: CreateProjectReq): IO[Out[ProjectView]] =
    write(
      p,
      TaskRepo
        .createProject(r.name, r.propertyId)
        .flatMap(id =>
          TaskRepo.listProjects.map(_.find(_.id == id).map(pv).getOrElse(ProjectView(id, r.name, r.propertyId)))
        )
    ).transact(xa)
  def list(xa: Transactor[IO], p: Principal, project: Option[UUID]): IO[Out[List[TaskView]]] =
    read(p, TaskRepo.listTasks(project).map(_.map(tv))).transact(xa)
  def create(xa: Transactor[IO], p: Principal, r: CreateTaskReq): IO[Out[TaskView]] =
    write(
      p,
      TaskRepo
        .createTask(r.projectId, r.title, r.dueOn, r.recurrence)
        .map(t => TaskView(t.id, Some(r.projectId), t.title, t.status, r.dueOn, t.recurrence))
    ).transact(xa)
  def complete(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[CompleteResult]] =
    write(
      p,
      for {
        next <- TaskRepo.complete(id)
        meta <- TaskRepo.ownerAndTitle(id)
        // F34: emit task.completed in the same tx as the write (transactional outbox).
        _ <- meta.traverse_ { case (owner, title) =>
          EventRepo.emit(
            Envelope(
              "task.completed",
              Actor.user(p.userId),
              Subject("task", id),
              owner.getOrElse(p.userId),
              None,
              Json.obj("title" -> title.asJson, "completed_by" -> p.email.asJson)
            )
          )
        }
      } yield CompleteResult(id, next)
    ).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val projectsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "task-projects")
    .errorOut(err)
    .out(jsonBody[List[ProjectView]])
    .summary("Task projects")
  val createProjectEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "task-projects")
    .in(jsonBody[CreateProjectReq])
    .errorOut(err)
    .out(jsonBody[ProjectView])
    .summary("Create a task project")
  val listEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "tasks")
    .in(query[Option[UUID]]("project"))
    .errorOut(err)
    .out(jsonBody[List[TaskView]])
    .summary("Tasks (optionally by project)")
  val createEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "tasks")
    .in(jsonBody[CreateTaskReq])
    .errorOut(err)
    .out(jsonBody[TaskView])
    .summary("Create a task")
  val completeEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "tasks" / path[UUID]("id") / "complete")
    .errorOut(err)
    .out(jsonBody[CompleteResult])
    .summary("Complete a task (recurring → next occurrence)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    projectsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => projects(xa, p)),
    createProjectEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateProjectReq) => createProject(xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (proj: Option[UUID]) => list(xa, p, proj)),
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateTaskReq) => create(xa, p, r)),
    completeEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => complete(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(projectsEndpoint, createProjectEndpoint, listEndpoint, createEndpoint, completeEndpoint)
}
