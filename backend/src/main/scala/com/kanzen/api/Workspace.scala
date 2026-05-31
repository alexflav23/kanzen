package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.calendar.WorkspaceCalendarMapRepo
import com.kanzen.workspace.{WorkspaceAuth, WorkspaceRepo}
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

/** F44 — Settings → Integrations → Workspace. The tenant's super-admin connects a Google Workspace service account; we
  * store only the Secrets-Manager *reference* (never the key) + run a validation probe through the WorkspaceAuth seam.
  * The live token-exchange is operator-gated; the connect/status surface + the seam are wired now so it's a drop-in.
  * Tenant-scoped + principal-only (acts as `admin:integrations`).
  */
object Workspace {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ConnectReq(domain: String, serviceAccountEmail: String, serviceAccountJson: String)
  final case class StatusView(
      connected: Boolean,
      domain: Option[String],
      validated: Boolean,
      validationError: Option[String],
      calendarId: Option[String] = None // F07 Path B — the mapped Google calendar, if any
  )
  final case class CalendarReq(googleCalendarId: String)

  private def forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Only the principal can manage integrations."))
  private def bad(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def status(xa: Transactor[IO], p: Principal): IO[Out[StatusView]] =
    (WorkspaceRepo.find(p.tenantId), WorkspaceCalendarMapRepo.find(p.tenantId)).tupled.transact(xa).map {
      case (None, _) => Right(StatusView(connected = false, None, validated = false, None))
      case (Some(w), cal) =>
        Right(
          StatusView(
            connected = true,
            Some(w.domain),
            w.validatedAt.isDefined,
            w.validationError,
            cal.map(_.googleCalendarId)
          )
        )
    }

  // F07 Path B — map a Google calendar for this tenant (principal-only; requires Workspace to be connected first).
  def setCalendar(xa: Transactor[IO], p: Principal, req: CalendarReq): IO[Out[StatusView]] =
    if (p.role != "principal") IO.pure(Left(forbidden))
    else if (req.googleCalendarId.trim.isEmpty) IO.pure(Left(bad("a Google calendar id is required")))
    else
      WorkspaceRepo.find(p.tenantId).transact(xa).flatMap {
        case None =>
          IO.pure(Left(bad("connect Google Workspace before mapping a calendar")))
        case Some(_) =>
          WorkspaceCalendarMapRepo
            .connect(p.tenantId, "all", req.googleCalendarId.trim, "push", p.userId)
            .transact(xa) *> status(xa, p)
      }

  def connect(xa: Transactor[IO], wsAuth: WorkspaceAuth, p: Principal, req: ConnectReq): IO[Out[StatusView]] =
    if (p.role != "principal") IO.pure(Left(forbidden))
    else if (req.domain.trim.isEmpty || !req.serviceAccountEmail.contains("@"))
      IO.pure(Left(bad("domain + a service-account email are required")))
    // structural check of the pasted key JSON (we never persist it; only a Secrets-Manager ref)
    else if (!req.serviceAccountJson.contains("private_key") || !req.serviceAccountJson.contains("client_email"))
      IO.pure(Left(bad("that doesn't look like a service-account JSON key (missing private_key/client_email)")))
    else {
      // F44 §4: real impl writes the key bytes to Secrets Manager and stores the ref. Sandbox: a deterministic dev ref.
      val secretsRef = s"dev:workspace:${p.tenantId}"
      val scopes = List("https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/calendar")
      for {
        id <- WorkspaceRepo
          .connect(p.tenantId, req.domain.trim, req.serviceAccountEmail.trim, secretsRef, scopes, p.userId)
          .transact(xa)
        // validation probe through the seam: the live impl hits Google's userinfo + checks hd=domain; the stub proves
        // the wiring (succeeds once the row exists). Persist the outcome.
        probe <- wsAuth.tokenFor(p.tenantId, p.email, List("openid")).attempt
        _ <- probe match {
          case Right(_) => WorkspaceRepo.setValidated(id).transact(xa)
          case Left(e) => WorkspaceRepo.setValidationError(id, e.getMessage).transact(xa)
        }
        st <- status(xa, p)
      } yield st
    }

  private val err = statusCode.and(jsonBody[ApiError])

  val statusEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), StatusView, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "workspace")
      .errorOut(err)
      .out(jsonBody[StatusView])
      .summary("This tenant's Google Workspace connection status (F44)")

  val connectEndpoint: Endpoint[String, ConnectReq, (StatusCode, ApiError), StatusView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "workspace" / "connect")
      .in(jsonBody[ConnectReq])
      .errorOut(err)
      .out(jsonBody[StatusView])
      .summary("Connect a Google Workspace service account (principal-only; stores only the secret ref)")

  val calendarEndpoint: Endpoint[String, CalendarReq, (StatusCode, ApiError), StatusView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "workspace" / "calendar")
      .in(jsonBody[CalendarReq])
      .errorOut(err)
      .out(jsonBody[StatusView])
      .summary("Map a Google calendar for this tenant (F07 Path B; principal-only, requires Workspace connected)")

  def serverEndpoints(a: Auth, xa: Transactor[IO], wsAuth: WorkspaceAuth): List[ServerEndpoint[Any, IO]] = List(
    statusEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => status(xa, p)),
    connectEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ConnectReq) => connect(xa, wsAuth, p, r)),
    calendarEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CalendarReq) => setCalendar(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] = List(statusEndpoint, connectEndpoint, calendarEndpoint)
}
