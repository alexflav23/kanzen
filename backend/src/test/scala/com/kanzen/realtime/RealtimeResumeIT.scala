package com.kanzen.realtime

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Principal
import com.kanzen.authz.{Authorizer, Authz}
import com.kanzen.db.TestDb
import com.kanzen.events.{Actor, EventRepo, Envelope, Subject}
import com.kanzen.people.{AssigneeScope, PeopleRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import weaver.IOSuite

import java.util.UUID

/** F48 RT.1b — websocket resume. The outbox carries a monotonic `seq`; a reconnecting client replays everything after
  * the cursor it last saw, authz-filtered exactly like the live stream (no backfill leak).
  */
object RealtimeResumeIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val owner = UUID.fromString("10000000-0000-0000-0000-000000000001")
  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val marcia =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000003"), "m", "marcia@kanzen.local", "staff")

  private def emit(subjType: String, subjId: UUID): ConnectionIO[Long] =
    EventRepo.emit(Envelope(s"$subjType.created", Actor.system, Subject(subjType, subjId), owner, None, Json.obj())) *>
      sql"select max(seq) from event_outbox".query[Long].unique

  private def ctx(p: Principal, xa: Transactor[IO]): IO[(Authorizer, Option[AssigneeScope])] =
    (for {
      authz <- Authz.forUser(p.userId, p.role)
      scope <-
        if (p.role == "staff") PeopleRepo.assigneeScope(p.userId)
        else Option.empty[AssigneeScope].pure[ConnectionIO]
    } yield (authz, scope)).transact(xa)

  test("rowsSince returns only the rows after the cursor, oldest-first, bounded") { xa =>
    for {
      cursor <- sql"select coalesce(max(seq),0) from event_outbox".query[Long].unique.transact(xa)
      _ <- (emit("task", UUID.randomUUID()) *> emit("task", UUID.randomUUID()) *> emit("task", UUID.randomUUID()))
        .transact(xa)
      rows <- EventRepo.rowsSince(cursor, 500).transact(xa)
      seqs = rows.map(_.seq)
    } yield expect(seqs.size >= 3) and
      expect(seqs.forall(_ > cursor)) and
      expect(seqs == seqs.sorted) // oldest-first
  }

  test("the replay is authz-filtered: a finance event in the gap is replayed to the Principal, not to Staff") { xa =>
    for {
      cursor <- sql"select coalesce(max(seq),0) from event_outbox".query[Long].unique.transact(xa)
      // a Principal-private finance event happens "while both were disconnected"
      _ <- emit("expense", UUID.randomUUID()).transact(xa)
      missed <- EventRepo.rowsSince(cursor, 500).map(_.map(RtEvent.fromRow)).transact(xa)
      m <- ctx(marcia, xa)
      t <- ctx(toby, xa)
      marciaReplay <- missed.filterA(ev => RealtimeFilter.visible(ev, marcia, m._1, m._2, xa))
      tobyReplay <- missed.filterA(ev => RealtimeFilter.visible(ev, toby, t._1, t._2, xa))
    } yield expect(missed.exists(_.subjectType == "expense")) and
      expect(!marciaReplay.exists(_.subjectType == "expense")) and // no backfill leak over resume
      expect(tobyReplay.exists(_.subjectType == "expense")) and
      expect(tobyReplay.forall(_.seq > 0L)) // replayed events carry their cursor
  }

  test("the cursor boundary is exclusive: a client at a row's own seq never re-receives that row") { xa =>
    // (asserting the boundary rather than global emptiness — the test DB is shared, so other suites emit concurrently)
    for {
      s <- emit("task", UUID.randomUUID()).transact(xa) // s = this event's seq (the client's cursor after seeing it)
      rows <- EventRepo.rowsSince(s, 500).transact(xa)
    } yield expect(rows.forall(_.seq > s)) and expect(!rows.exists(_.seq == s))
  }
}
