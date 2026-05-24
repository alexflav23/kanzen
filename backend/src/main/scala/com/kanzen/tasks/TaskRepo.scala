package com.kanzen.tasks

import cats.syntax.all._
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

/** F06 — recurrence: completing a recurring task spawns the next occurrence. */
object TaskService {
  def nextDue(current: LocalDate, freq: String): LocalDate = freq match {
    case "daily"   => current.plusDays(1)
    case "weekly"  => current.plusWeeks(1)
    case "monthly" => current.plusMonths(1)
    case _         => current.plusWeeks(1)
  }
}

final case class Task(id: UUID, title: String, status: String, recurrence: Option[String])
final case class TaskProject(id: UUID, name: String, propertyId: Option[UUID])
final case class TaskRow(id: UUID, projectId: Option[UUID], title: String, status: String, dueOn: Option[LocalDate], recurrence: Option[String])

object TaskRepo {
  def createProject(name: String, propertyId: Option[UUID]): ConnectionIO[UUID] =
    sql"insert into task_projects (name, property_id) values ($name, $propertyId) returning id".query[UUID].unique

  def listProjects: ConnectionIO[List[TaskProject]] =
    sql"select id, name, property_id from task_projects order by name".query[TaskProject].to[List]

  def listTasks(projectId: Option[UUID]): ConnectionIO[List[TaskRow]] = {
    val base     = fr"select id, project_id, title, status, due_on, recurrence from tasks"
    val filtered = projectId.fold(base)(pid => base ++ fr"where project_id = $pid")
    (filtered ++ fr"order by due_on nulls last, created_at desc").query[TaskRow].to[List]
  }

  def createTask(projectId: UUID, title: String, dueOn: Option[LocalDate], recurrence: Option[String]): ConnectionIO[Task] =
    sql"""insert into tasks (project_id, title, due_on, recurrence) values ($projectId, $title, $dueOn, $recurrence)
          returning id, title, status, recurrence""".query[Task].unique

  /** Complete a task; if recurring, materialise the next occurrence and return its id. */
  def complete(taskId: UUID): ConnectionIO[Option[UUID]] =
    for {
      row <- sql"select recurrence, due_on, project_id, title from tasks where id = $taskId"
        .query[(Option[String], Option[LocalDate], UUID, String)].unique
      _ <- sql"update tasks set status = 'done', completed_at = now() where id = $taskId".update.run
      next <- row._1 match {
        case Some(freq) =>
          val nd = row._2.map(d => TaskService.nextDue(d, freq))
          sql"insert into tasks (project_id, title, due_on, recurrence) values (${row._3}, ${row._4}, $nd, $freq) returning id"
            .query[UUID].unique.map(Option(_))
        case None => Option.empty[UUID].pure[ConnectionIO]
      }
    } yield next

  def get(taskId: UUID): ConnectionIO[Option[Task]] =
    sql"select id, title, status, recurrence from tasks where id = $taskId".query[Task].option

  /** owner + title of a task (for the F34 event envelope). */
  def ownerAndTitle(taskId: UUID): ConnectionIO[Option[(Option[UUID], String)]] =
    sql"select owner_id, title from tasks where id = $taskId".query[(Option[UUID], String)].option
}
