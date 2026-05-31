package com.kanzen.api

import cats.effect.IO
import com.kanzen.api.Workspace.ConnectReq
import com.kanzen.auth.Principal
import com.kanzen.db.TestDb
import com.kanzen.workspace.StubWorkspaceAuth
import doobie.implicits._
import doobie.postgres.implicits._
import doobie.util.transactor.Transactor
import weaver.IOSuite

import java.util.UUID

/** F44 — the Workspace-auth substrate. Connect stores only the Secrets-Manager *ref* (never the key), runs the
  * validation probe through the WorkspaceAuth seam, and is principal-only + tenant-scoped. The live token-exchange is
  * operator-gated; this proves every seam around it is wired.
  */
object WorkspaceApiIT extends IOSuite {
  type Res = Transactor[IO]
  override def sharedResource = TestDb.transactor

  private val toby =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000001"), "t", "flavian@kanzen.local", "principal")
  private val lorna =
    Principal(UUID.fromString("10000000-0000-0000-0000-000000000002"), "l", "lorna@kanzen.local", "manager")

  // a structurally-valid service-account key JSON (the bytes never land in Postgres — only a Secrets-Manager ref).
  private val keyJson =
    """{"type":"service_account","client_email":"kanzen@proj.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"}"""

  test("connect (principal): writes the integration row, the probe validates via the seam, status reflects it") { xa =>
    val ws = new StubWorkspaceAuth(xa)
    for {
      before <- Workspace.status(xa, toby).map(_.toOption.get)
      out <- Workspace.connect(xa, ws, toby, ConnectReq("kanzen.local", "kanzen@proj.iam.gserviceaccount.com", keyJson))
      after = out.toOption.get
      // the key bytes never persist — only the deterministic dev ref
      ref <- sql"select secrets_manager_ref from workspace_integrations where tenant_id = ${toby.tenantId}"
        .query[String]
        .unique
        .transact(xa)
    } yield expect(!before.connected) and
      expect(after.connected) and
      expect(after.domain.contains("kanzen.local")) and
      expect(after.validated) and // stub probe succeeds once the row exists
      expect(after.validationError.isEmpty) and
      expect(ref == s"dev:workspace:${toby.tenantId}") and
      expect(!ref.contains("PRIVATE KEY"))
  }

  test("F07 Path B — a connected tenant can map a Google calendar; it shows in status (principal-only)") { xa =>
    val ws = new StubWorkspaceAuth(xa)
    for {
      _ <- Workspace.connect(xa, ws, toby, ConnectReq("kanzen.local", "kanzen@proj.iam.gserviceaccount.com", keyJson))
      mapped <- Workspace.setCalendar(xa, toby, Workspace.CalendarReq("household@group.calendar.google.com"))
      st <- Workspace.status(xa, toby).map(_.toOption.get)
      mgr <- Workspace.setCalendar(xa, lorna, Workspace.CalendarReq("x@g"))
    } yield expect(mapped.toOption.exists(_.calendarId.contains("household@group.calendar.google.com"))) and
      expect(st.calendarId.contains("household@group.calendar.google.com")) and
      expect(mgr.left.exists(_._1.code == 403)) // only the principal maps the calendar
  }

  test("F07 Path B — mapping a calendar before connecting Workspace is rejected") { xa =>
    for {
      otherTenant <-
        sql"insert into tenants (slug, name) values (${"wc-" + UUID.randomUUID()}, 'NoWs') returning id"
          .query[UUID].unique.transact(xa)
      principal = Principal(UUID.randomUUID(), "o", "o@x", "principal", None, otherTenant)
      res <- Workspace.setCalendar(xa, principal, Workspace.CalendarReq("cal@g"))
    } yield expect(res.left.exists(_._1.code == 400)) // must connect Workspace first
  }

  test("only the principal can connect — a manager is forbidden") { xa =>
    val ws = new StubWorkspaceAuth(xa)
    Workspace
      .connect(xa, ws, lorna, ConnectReq("kanzen.local", "x@proj.iam.gserviceaccount.com", keyJson))
      .map(out => expect(out.left.exists(_._1.code == 403)))
  }

  test("a pasted blob that isn't a service-account key is rejected") { xa =>
    val ws = new StubWorkspaceAuth(xa)
    Workspace
      .connect(xa, ws, toby, ConnectReq("kanzen.local", "x@proj.iam.gserviceaccount.com", "not a key"))
      .map(out => expect(out.left.exists(_._1.code == 400)))
  }

  test("tenant isolation: another tenant's principal sees not-connected and the seam denies a token") { xa =>
    for {
      otherTenant <-
        sql"insert into tenants (slug, name) values (${"wt-" + UUID.randomUUID()}, 'Other') returning id"
          .query[UUID]
          .unique
          .transact(xa)
      outsider = Principal(UUID.randomUUID(), "o", "o@x", "principal", None, otherTenant)
      st <- Workspace.status(xa, outsider).map(_.toOption.get)
      ws = new StubWorkspaceAuth(xa)
      denied <- ws.tokenFor(otherTenant, "o@x", List("openid")).attempt
    } yield expect(!st.connected) and expect(denied.isLeft)
  }
}
