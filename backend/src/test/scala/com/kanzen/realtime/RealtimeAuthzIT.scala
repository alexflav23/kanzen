package com.kanzen.realtime

import com.kanzen.tenant.Tenant
import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Principal
import com.kanzen.authz.{Authorizer, Authz}
import com.kanzen.db.TestDb
import com.kanzen.inbox.CollabInboxRepo
import com.kanzen.people.{AssigneeScope, PeopleRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F48 §7 — the realtime authz filter has its own no-leak IT. Every push is filtered server-side before it leaves the
  * JVM: a Staff socket never receives a Principal-mailbox thread event nor any finance (Principal-private) event; the
  * Principal's own socket does.
  */
object RealtimeAuthzIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  private def threadEv(tid: UUID): RtEvent =
    RtEvent("email_thread.assigned", "email_thread", Some(tid), None, None, Json.obj())
  private val expenseEv: RtEvent =
    RtEvent("expense.submitted", "expense", Some(UUID.randomUUID()), None, None, Json.obj())

  private def ctx(p: Principal, xa: Transactor[IO]): IO[(Authorizer, Option[AssigneeScope])] =
    (for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <-
        if (p.role == "staff") PeopleRepo.assigneeScope(p.userId)
        else Option.empty[AssigneeScope].pure[ConnectionIO]
    } yield (authz, scope)).transact(xa)

  test("a Principal-mailbox thread event is filtered from a Staff socket, delivered to the Principal") { xa =>
    for {
      principalTid <-
        sql"""select t.id from email_threads t join mail_inboxes i on i.id = t.inbox_id
              where i.visibility = 'principal' limit 1""".query[UUID].unique.transact(xa)
      m <- ctx(marcia, xa)
      t <- ctx(toby, xa)
      marciaSees <- RealtimeFilter.visible(threadEv(principalTid), marcia, m._1, m._2, xa)
      tobySees <- RealtimeFilter.visible(threadEv(principalTid), toby, t._1, t._2, xa)
    } yield expect(!marciaSees) and expect(tobySees)
  }

  test("a thread in the Staff's own scope IS delivered to that Staff socket") { xa =>
    for {
      mScope <- PeopleRepo.assigneeScope(marcia.userId).transact(xa)
      visible <- CollabInboxRepo.threads(Tenant.DefaultId, None, "inbox", None, mScope, "staff").transact(xa)
      m <- ctx(marcia, xa)
      // marcia has at least one visible thread (Wardian/Deliveries) — the filter must pass it through
      sees <- visible.headOption.fold(IO.pure(true))(t =>
        RealtimeFilter.visible(threadEv(t.id), marcia, m._1, mScope, xa)
      )
    } yield expect(visible.nonEmpty) and expect(sees)
  }

  test("a finance (Principal-private) event is filtered from a Staff socket, delivered to the Principal") { xa =>
    for {
      m <- ctx(marcia, xa)
      t <- ctx(toby, xa)
      marciaSees <- RealtimeFilter.visible(expenseEv, marcia, m._1, m._2, xa)
      tobySees <- RealtimeFilter.visible(expenseEv, toby, t._1, t._2, xa)
    } yield expect(!marciaSees) and expect(tobySees)
  }
}
