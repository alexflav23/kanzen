package com.kanzen.workspace

import cats.effect.IO
import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.Instant
import java.util.UUID

/** F44 — one row per tenant that's connected a Google Workspace (the reference + validation state; never the key). */
final case class WorkspaceIntegration(
    id: UUID,
    domain: String,
    serviceAccountEmail: String,
    authorizedScopes: List[String],
    validatedAt: Option[Instant],
    validationError: Option[String]
)

object WorkspaceRepo {
  def find(tenantId: UUID): ConnectionIO[Option[WorkspaceIntegration]] =
    sql"""select id, domain, service_account_email, authorized_scopes, validated_at, validation_error
          from workspace_integrations where tenant_id = $tenantId and deleted_at is null limit 1"""
      .query[WorkspaceIntegration]
      .option

  /** Upsert the integration reference for a tenant (idempotent on (tenant_id, domain)). */
  def connect(
      tenantId: UUID,
      domain: String,
      serviceAccountEmail: String,
      secretsRef: String,
      scopes: List[String],
      createdBy: UUID
  ): ConnectionIO[UUID] =
    sql"""insert into workspace_integrations
            (tenant_id, domain, service_account_email, secrets_manager_ref, authorized_scopes, created_by)
          values ($tenantId, $domain, $serviceAccountEmail, $secretsRef, $scopes, $createdBy)
          on conflict (tenant_id, domain) do update set
            service_account_email = excluded.service_account_email,
            secrets_manager_ref = excluded.secrets_manager_ref,
            authorized_scopes = excluded.authorized_scopes,
            validation_error = null
          returning id""".query[UUID].unique

  def setValidated(id: UUID): ConnectionIO[Int] =
    sql"update workspace_integrations set validated_at = now(), validation_error = null where id = $id".update.run

  def setValidationError(id: UUID, err: String): ConnectionIO[Int] =
    sql"update workspace_integrations set validation_error = $err, validated_at = null where id = $id".update.run
}

/** Raised when a producer asks for a token but the tenant has no connected Workspace. */
final case class WorkspaceNotConnected(tenantId: UUID)
    extends RuntimeException(s"No Google Workspace connected for tenant $tenantId")

/** F44 §3 — the auth substrate the four downstream integrations (GmailSender, GmailWatcher, CalendarSyncConsumer,
  * DriveReader) all share: a short-lived, impersonated, scope-minimal access token for `userEmail` in the tenant's
  * Workspace. The live impl signs a service-account JWT (sub = userEmail) and exchanges it at Google's token endpoint,
  * caching per (tenant, user, scopes) until exp-60s. In the sandbox we have no service account, so [[StubWorkspaceAuth]]
  * stands in: it enforces the *contract* (WorkspaceNotConnected when the tenant hasn't connected) so every producer is
  * already wired correctly, and the operator's only remaining step is dropping in the real token exchange.
  */
trait WorkspaceAuth {
  def tokenFor(tenantId: UUID, userEmail: String, scopes: List[String]): IO[String]
}

/** Sandbox stand-in: honours the connected/not-connected contract; returns a clearly-marked stub token when connected.
  * Swapped for the real RS256-JWT + Google token-exchange impl behind this same trait once the operator provisions the
  * service account JSON (per `SETUP.md`).
  */
final class StubWorkspaceAuth(xa: doobie.util.transactor.Transactor[IO]) extends WorkspaceAuth {
  def tokenFor(tenantId: UUID, userEmail: String, scopes: List[String]): IO[String] =
    WorkspaceRepo.find(tenantId).transact(xa).flatMap {
      case None => IO.raiseError(WorkspaceNotConnected(tenantId))
      case Some(_) => IO.pure(s"stub-token:$tenantId:$userEmail:${scopes.mkString(",")}")
    }
}
