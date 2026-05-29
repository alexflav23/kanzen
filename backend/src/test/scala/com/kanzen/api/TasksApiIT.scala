package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Tasks.{CreateProjectReq, CreateTaskReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.time.LocalDate
import java.util.UUID

/** F06 — native tasks: operational (Staff/Manager/Principal); completing a recurring task spawns the next occurrence.
  */
object TasksApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")
  private val lorna = Principal(UUID.randomUUID(), "l", "lorna@kanzen.local", "manager")

  test("seeded project + tasks are listable; a recurring task spawns its next occurrence on complete") { xa =>
    for {
      proj <- Tasks.createProject(xa, lorna, CreateProjectReq("Test Project", None)).map(_.toOption.get)
      t <- Tasks
        .create(xa, lorna, CreateTaskReq(proj.id, "Recurring chore", Some(LocalDate.now), Some("weekly")))
        .map(_.toOption.get)
      done <- Tasks.complete(xa, lorna, t.id).map(_.toOption.get)
      list <- Tasks.list(xa, lorna, Some(proj.id)).map(_.toOption.get)
    } yield expect(done.completed == t.id) and
      expect(done.nextTaskId.isDefined) and // recurrence materialised the next
      expect(list.exists(x => x.title == "Recurring chore" && x.status == "todo")) // the next occurrence
  }

  test("Staff can manage tasks (operational)") { xa =>
    for {
      proj <- Tasks.createProject(xa, marcia, CreateProjectReq("Marcia's list", None))
      task <- Tasks.create(xa, marcia, CreateTaskReq(proj.toOption.get.id, "Polish silver", None, None))
    } yield expect(proj.isRight) and expect(task.toOption.exists(_.title == "Polish silver"))
  }

  test("a non-recurring task completes without spawning a next") { xa =>
    for {
      proj <- Tasks.createProject(xa, lorna, CreateProjectReq("One-offs", None)).map(_.toOption.get)
      t <- Tasks.create(xa, lorna, CreateTaskReq(proj.id, "Fix the gate", None, None)).map(_.toOption.get)
      done <- Tasks.complete(xa, lorna, t.id).map(_.toOption.get)
    } yield expect(done.nextTaskId.isEmpty)
  }

  test("W6.2 — a task carries an assignee + due date + recurrence, and recurrence preserves the assignee") { xa =>
    val marciaId = UUID.fromString("10000000-0000-0000-0000-000000000003")
    for {
      proj <- Tasks.createProject(xa, lorna, CreateProjectReq("Assigned work", None)).map(_.toOption.get)
      t <- Tasks
        .create(
          xa,
          lorna,
          CreateTaskReq(
            proj.id,
            "Water the plants",
            Some(LocalDate.now),
            Some("weekly"),
            priority = Some("high"),
            assigneeId = Some(marciaId)
          )
        )
        .map(_.toOption.get)
      done <- Tasks.complete(xa, lorna, t.id).map(_.toOption.get)
      list <- Tasks.list(xa, lorna, Some(proj.id)).map(_.toOption.get)
      next = list.find(x => x.title == "Water the plants" && x.status == "todo")
    } yield expect(t.assigneeId.contains(marciaId)) and expect(t.dueOn.contains(LocalDate.now)) and
      expect(t.priority == "high") and
      // assignee AND priority carry to the spawned occurrence
      expect(next.exists(_.assigneeId.contains(marciaId))) and expect(next.exists(_.priority == "high"))
  }
}
