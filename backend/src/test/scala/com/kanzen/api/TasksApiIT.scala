package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Tasks.{CreateProjectReq, CreateTaskReq}
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.people.PeopleRepo
import doobie.implicits._
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
  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")

  test(
    "F02v2 — a Staff member sees only tasks assigned to them; another person's task is hidden (Principal sees all)"
  ) { xa =>
    for {
      scope <- PeopleRepo.assigneeScope(marcia.userId).transact(xa) // Marcia's own person id
      marciaPid = scope.get.personId
      proj <- Tasks.createProject(xa, lorna, CreateProjectReq("Scope Project", None)).map(_.toOption.get)
      mine <- Tasks
        .create(xa, lorna, CreateTaskReq(proj.id, "Marcia's job", None, None, assigneeId = Some(marciaPid)))
        .map(_.toOption.get)
      theirs <- Tasks
        .create(
          xa,
          lorna,
          CreateTaskReq(proj.id, "Someone else's job", None, None, assigneeId = Some(UUID.randomUUID()))
        )
        .map(_.toOption.get)
      staffList <- Tasks.list(xa, marcia, None).map(_.toOption.get)
      principalList <- Tasks.list(xa, toby, None).map(_.toOption.get)
      // a Staff completing a task that isn't theirs is forbidden
      denied <- Tasks.complete(xa, marcia, theirs.id)
    } yield expect(staffList.exists(_.id == mine.id)) and expect(!staffList.exists(_.id == theirs.id)) and
      expect(principalList.exists(_.id == mine.id)) and expect(principalList.exists(_.id == theirs.id)) and
      expect(denied.left.exists(_._1.code == 403))
  }

  test("F06 — a task can be linked to a property and an asset; the links round-trip with resolved labels") { xa =>
    val wardian = UUID.fromString("20000000-0000-0000-0000-000000000001")
    val richter = UUID.fromString("40000000-0000-0000-0000-000000000004")
    for {
      proj <- Tasks.createProject(xa, lorna, CreateProjectReq("Linked work", None)).map(_.toOption.get)
      t <- Tasks
        .create(
          xa,
          lorna,
          CreateTaskReq(
            proj.id,
            "Re-appraise the Richter",
            None,
            None,
            propertyId = Some(wardian),
            assetIds = Some(List(richter))
          )
        )
        .map(_.toOption.get)
      reFetched <- Tasks.list(xa, lorna, Some(proj.id)).map(_.toOption.get.find(_.id == t.id).get)
    } yield expect(t.links.exists(l => l.targetType == "asset" && l.targetId == richter)) and
      expect(t.links.exists(l => l.targetType == "property" && l.targetId == wardian)) and
      // labels are resolved from the real rows (asset title / property name), not just ids
      expect(reFetched.links.exists(l => l.targetType == "asset" && l.label.nonEmpty)) and
      expect(reFetched.links.exists(l => l.targetType == "property" && l.label.contains("Wardian")))
  }

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
