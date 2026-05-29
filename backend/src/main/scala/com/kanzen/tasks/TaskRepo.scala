package com.kanzen.tasks

import cats.data.NonEmptyList
import cats.syntax.all._
import com.kanzen.people.AssigneeScope
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

/** F06 — recurrence: completing a recurring task spawns the next occurrence. */
object TaskService {
  def nextDue(current: LocalDate, freq: String): LocalDate = freq match {
    case "daily" => current.plusDays(1)
    case "weekly" => current.plusWeeks(1)
    case "fortnightly" => current.plusWeeks(2)
    case "monthly" => current.plusMonths(1)
    case "quarterly" => current.plusMonths(3)
    case _ => current.plusWeeks(1)
  }
}

final case class Task(id: UUID, title: String, status: String, recurrence: Option[String])
final case class TaskProject(id: UUID, name: String, propertyId: Option[UUID])

/** What a task is *about* — a linked asset or property, with its resolved display label. */
final case class TaskLink(targetType: String, targetId: UUID, label: String)
final case class TaskRow(
    id: UUID,
    projectId: Option[UUID],
    title: String,
    status: String,
    dueOn: Option[LocalDate],
    recurrence: Option[String],
    priority: String,
    assigneeId: Option[UUID]
)

object TaskRepo {
  def createProject(name: String, propertyId: Option[UUID]): ConnectionIO[UUID] =
    sql"insert into task_projects (name, property_id) values ($name, $propertyId) returning id".query[UUID].unique

  def listProjects: ConnectionIO[List[TaskProject]] =
    sql"select id, name, property_id from task_projects order by name".query[TaskProject].to[List]

  /** A Staff viewer only sees tasks assigned to them, or unassigned tasks in their property: that scope as a SQL
    * predicate over `tasks t` (+ `task_projects pr` for the property). `All` viewers (Manager/Principal) pass None.
    */
  private def scopePred(scope: Option[AssigneeScope]): Fragment = scope match {
    case None => Fragment.empty
    case Some(AssigneeScope(person, Some(prop))) =>
      fr"and (t.assignee_id = $person or (t.assignee_id is null and pr.property_id = $prop))"
    case Some(AssigneeScope(person, None)) => fr"and t.assignee_id = $person"
  }

  def listTasks(projectId: Option[UUID], scope: Option[AssigneeScope] = None): ConnectionIO[List[TaskRow]] = {
    val base =
      fr"""select t.id, t.project_id, t.title, t.status, t.due_on, t.recurrence, t.priority, t.assignee_id
           from tasks t left join task_projects pr on pr.id = t.project_id where true"""
    val proj = projectId.fold(Fragment.empty)(pid => fr"and t.project_id = $pid")
    // Todoist-style ordering: by priority (urgent → low), then soonest due, then newest.
    (base ++ proj ++ scopePred(scope) ++
      fr"""order by case t.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
           t.due_on nulls last, t.created_at desc""").query[TaskRow].to[List]
  }

  /** Is this task within a Staff viewer's scope (assigned to them / unassigned in their property)? Gates writes. */
  def inScope(taskId: UUID, scope: AssigneeScope): ConnectionIO[Boolean] =
    (fr"""select exists(select 1 from tasks t left join task_projects pr on pr.id = t.project_id
          where t.id = $taskId""" ++ scopePred(Some(scope)) ++ fr")").query[Boolean].unique

  def createTask(
      projectId: UUID,
      title: String,
      dueOn: Option[LocalDate],
      recurrence: Option[String],
      priority: String = "normal",
      assigneeId: Option[UUID] = None
  ): ConnectionIO[Task] =
    sql"""insert into tasks (project_id, title, due_on, recurrence, priority, assignee_id)
          values ($projectId, $title, $dueOn, $recurrence, $priority, $assigneeId)
          returning id, title, status, recurrence""".query[Task].unique

  /** Complete a task; if recurring, materialise the next occurrence and return its id. */
  def complete(taskId: UUID): ConnectionIO[Option[UUID]] =
    for {
      row <- sql"select recurrence, due_on, project_id, title, assignee_id, priority from tasks where id = $taskId"
        .query[(Option[String], Option[LocalDate], UUID, String, Option[UUID], String)]
        .unique
      _ <- sql"update tasks set status = 'done', completed_at = now() where id = $taskId".update.run
      next <- row._1 match {
        case Some(freq) =>
          val nd = row._2.map(d => TaskService.nextDue(d, freq))
          // the next occurrence inherits the assignee AND the priority
          sql"""insert into tasks (project_id, title, due_on, recurrence, assignee_id, priority)
                values (${row._3}, ${row._4}, $nd, $freq, ${row._5}, ${row._6}) returning id"""
            .query[UUID]
            .unique
            .map(Option(_))
        case None => Option.empty[UUID].pure[ConnectionIO]
      }
    } yield next

  def get(taskId: UUID): ConnectionIO[Option[Task]] =
    sql"select id, title, status, recurrence from tasks where id = $taskId".query[Task].option

  /** owner + title of a task (for the F34 event envelope). */
  def ownerAndTitle(taskId: UUID): ConnectionIO[Option[(Option[UUID], String)]] =
    sql"select owner_id, title from tasks where id = $taskId".query[(Option[UUID], String)].option

  // ── task ↔ asset/property links (F06: what the task is about) ───────────────
  private val linkTypes = Set("asset", "property")

  def addLink(taskId: UUID, targetType: String, targetId: UUID): ConnectionIO[Int] =
    if (!linkTypes(targetType)) 0.pure[ConnectionIO]
    else
      sql"""insert into task_links (task_id, target_type, target_id) values ($taskId, $targetType, $targetId)
            on conflict do nothing""".update.run

  def removeLink(taskId: UUID, targetType: String, targetId: UUID): ConnectionIO[Int] =
    sql"delete from task_links where task_id = $taskId and target_type = $targetType and target_id = $targetId".update.run

  /** Links for a set of tasks, with labels resolved (asset title / property name); deleted targets are dropped. */
  def linksFor(taskIds: List[UUID]): ConnectionIO[Map[UUID, List[TaskLink]]] =
    NonEmptyList.fromList(taskIds) match {
      case None => Map.empty[UUID, List[TaskLink]].pure[ConnectionIO]
      case Some(ids) =>
        (fr"""select tl.task_id, tl.target_type, tl.target_id, coalesce(a.title, p.name)
              from task_links tl
              left join assets a on tl.target_type = 'asset' and a.id = tl.target_id and a.deleted_at is null
              left join properties p on tl.target_type = 'property' and p.id = tl.target_id and p.deleted_at is null
              where """ ++ Fragments.in(fr"tl.task_id", ids))
          .query[(UUID, String, UUID, Option[String])]
          .to[List]
          .map(_.collect { case (tid, typ, target, Some(label)) => tid -> TaskLink(typ, target, label) }
            .groupMap(_._1)(_._2))
    }
}
