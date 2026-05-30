package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.identity.UserRepo
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

  def create(xa: Transactor[IO], req: CreateTenantReq): IO[Out[CreateTenantResp]] = {
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
                "Tenant created. Verify the principal's email to continue setup."
              )
            ): Out[CreateTenantResp]
      } yield res
      tx.transact(xa)
    }
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val createEndpoint: PublicEndpoint[CreateTenantReq, (StatusCode, ApiError), CreateTenantResp, Any] =
    sttp.tapir.endpoint.post
      .in("api" / "tenants")
      .in(jsonBody[CreateTenantReq])
      .errorOut(err)
      .out(jsonBody[CreateTenantResp])
      .summary("Public: create a new tenant + its principal (onboarding step 1)")

  def serverEndpoints(xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] =
    List(createEndpoint.serverLogic(req => create(xa, req)))

  val endpoints: List[AnyEndpoint] = List(createEndpoint)
}
