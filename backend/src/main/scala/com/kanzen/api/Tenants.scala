package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.Auth
import com.kanzen.identity.UserRepo
import com.kanzen.mail.{Mailer, VerifyToken}
import com.kanzen.tenant.TenantRepo
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** F46 §3.1 — public tenant signup (the `account` step). Creates the tenant, its principal user (in the new tenant),
  * records the principal on the tenant, and seeds the onboarding state machine at `verify_email`. The magic-link email
  * (SES) is operator-gated; in the sandbox the principal signs in via the dev-token path.
  *
  * This is the door multi-tenancy opens through: every domain row the new principal creates is tenant-scoped (F45), so
  * a fresh tenant starts as a clean, isolated household.
  */
object Tenants {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class PrincipalReq(name: String, email: String)
  final case class CreateTenantReq(name: String, slug: String, principal: PrincipalReq)
  final case class CreateTenantResp(
      tenantId: UUID,
      slug: String,
      principalUserId: UUID,
      currentStep: String,
      note: String
  )

  // slug: 2–40 chars, lowercase alphanumerics + hyphens (it's a subdomain label).
  private val slugRe = "^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])$".r
  private def bad(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))
  private val slugTaken: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "slug_taken", "That workspace address is already taken."))

  def create(xa: Transactor[IO], mailer: Mailer, verifySecret: String, req: CreateTenantReq): IO[Out[CreateTenantResp]] = {
    val slug = req.slug.trim.toLowerCase
    val email = req.principal.email.trim.toLowerCase
    if (req.name.trim.isEmpty) IO.pure(Left(bad("a workspace name is required")))
    else if (slugRe.findFirstIn(slug).isEmpty)
      IO.pure(Left(bad("slug must be 2–40 lowercase letters, numbers or hyphens")))
    else if (!email.contains("@")) IO.pure(Left(bad("a valid principal email is required")))
    else {
      val tx = for {
        taken <- TenantRepo.slugTaken(slug)
        res <-
          if (taken) (Left(slugTaken): Out[CreateTenantResp]).pure[doobie.ConnectionIO]
          else
            for {
              tid <- TenantRepo.create(slug, req.name.trim)
              user <- UserRepo.createInTenant(req.principal.name.trim, email, "principal", tid)
              _ <- TenantRepo.setPrincipal(tid, user.id)
              _ <- TenantRepo.initSetup(tid, "verify_email")
            } yield Right(
              CreateTenantResp(
                tid,
                slug,
                user.id,
                "verify_email",
                "Workspace created. Check your email to verify and continue setup."
              )
            ): Out[CreateTenantResp]
      } yield res
      // After the durable commit, send the verification magic-link through the Mailer seam (StubMailer records it in
      // the sandbox; SesMailer delivers it once the operator verifies the SES domain).
      tx.transact(xa).flatMap {
        case Right(resp) =>
          IO.realTimeInstant.flatMap { now =>
            val token = VerifyToken.mint(resp.tenantId, resp.principalUserId, verifySecret, now.getEpochSecond)
            val body =
              s"""Welcome to Kanzen. Confirm your email to finish setting up "${req.name.trim}".
                 |
                 |Verify: /verify?token=$token
                 |
                 |This link expires in 7 days.""".stripMargin
            mailer.send(Some(resp.tenantId), email, "Verify your Kanzen workspace", body, "verify_email").as(Right(resp))
          }
        case left => IO.pure(left)
      }
    }
  }

  // F46 — consume a verification magic-link: the token IS the capability (no bearer), so this is public. Advances the
  // tenant's `verify_email` step → `workspace`. A bad/expired/tampered token → 400 (the link is dead).
  final case class VerifyResp(verified: Boolean, nextStep: Option[String])

  def verify(xa: Transactor[IO], verifySecret: String, token: String): IO[Out[VerifyResp]] =
    IO.realTimeInstant.flatMap { now =>
      VerifyToken.parse(token, verifySecret, now.getEpochSecond) match {
        case None => IO.pure(Left(bad("this verification link is invalid or has expired")))
        case Some((tid, _)) =>
          (TenantRepo.advance(tid, "verify_email") *> TenantRepo.setupState(tid)).transact(xa).map {
            case Some((step, _)) => Right(VerifyResp(verified = true, step))
            case None => Right(VerifyResp(verified = true, None))
          }
      }
    }

  // F46 §4 — the onboarding state the Dashboard banner reads. `completed` true → no banner.
  final case class SetupState(currentStep: Option[String], completed: Boolean)
  final case class AdvanceReq(step: String)

  private val err = statusCode.and(jsonBody[ApiError])

  val createEndpoint: PublicEndpoint[CreateTenantReq, (StatusCode, ApiError), CreateTenantResp, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "tenants")
      .in(jsonBody[CreateTenantReq])
      .errorOut(err)
      .out(jsonBody[CreateTenantResp])
      .summary("Public: create a new tenant + its principal (onboarding step 1; emails a verification link)")

  final case class VerifyReq(token: String)
  val verifyEndpoint: PublicEndpoint[VerifyReq, (StatusCode, ApiError), VerifyResp, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "tenant" / "verify")
      .in(jsonBody[VerifyReq])
      .errorOut(err)
      .out(jsonBody[VerifyResp])
      .summary("Public: consume an email-verification magic-link (the token is the capability)")

  val setupEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), SetupState, Any] =
    sttp.tapir.endpoint.get
      .in("api" / "tenant" / "setup")
      .securityIn(auth.bearer[String]())
      .errorOut(err)
      .out(jsonBody[SetupState])
      .summary("The caller's tenant onboarding state (drives the Dashboard setup banner)")

  def setup(xa: Transactor[IO], tenantId: UUID): IO[SetupState] =
    TenantRepo
      .setupState(tenantId)
      .transact(xa)
      .map {
        case Some((step, completed)) => SetupState(step, completed)
        case None => SetupState(None, completed = true) // no row (e.g. legacy) → treat as done, no banner
      }

  val advanceEndpoint: Endpoint[String, AdvanceReq, (StatusCode, ApiError), SetupState, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "tenant" / "setup" / "advance")
      .securityIn(auth.bearer[String]())
      .in(jsonBody[AdvanceReq])
      .errorOut(err)
      .out(jsonBody[SetupState])
      .summary("Mark an onboarding step done + advance to the next (the wizard's Save & continue / Skip)")

  def advance(xa: Transactor[IO], tenantId: UUID, step: String): IO[Out[SetupState]] =
    if (!TenantRepo.stepOrder.contains(step)) IO.pure(Left(bad(s"unknown onboarding step '$step'")))
    else
      (TenantRepo.advance(tenantId, step) *> TenantRepo.setupState(tenantId)).transact(xa).map {
        case Some((s, c)) => Right(SetupState(s, c))
        case None => Right(SetupState(None, completed = true))
      }

  def publicServerEndpoints(xa: Transactor[IO], mailer: Mailer, verifySecret: String): List[ServerEndpoint[Any, IO]] =
    List(
      createEndpoint.serverLogic(req => create(xa, mailer, verifySecret, req)),
      verifyEndpoint.serverLogic(r => verify(xa, verifySecret, r.token))
    )

  def securedServerEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] =
    List(
      setupEndpoint
        .serverSecurityLogic(a.securityLogic)
        .serverLogic(p => (_: Unit) => setup(xa, p.tenantId).map(Right(_): Out[SetupState])),
      advanceEndpoint
        .serverSecurityLogic(a.securityLogic)
        // only the tenant's principal drives the wizard (F46 §5)
        .serverLogic(p =>
          (r: AdvanceReq) =>
            if (p.role != "principal")
              IO.pure(Left((StatusCode.Forbidden, ApiError(403, "forbidden", "Only the principal can run setup."))))
            else advance(xa, p.tenantId, r.step)
        )
    )

  val endpoints: List[AnyEndpoint] = List(createEndpoint, verifyEndpoint, setupEndpoint, advanceEndpoint)
}
