package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.Authz
import com.kanzen.property.{Property, PropertyRepo}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.util.UUID

/** Phase 1 walking skeleton — `GET /api/properties`: the first DB-backed, authz-gated
  * read. Bearer → `Principal` (Cognito JWKS) → the role's rules from `permission_rules`
  * (F02, default-deny) → `PropertyRepo.list` from Postgres, or 403. Proves config →
  * migrate → auth → authorize → query → JSON end-to-end. */
object Properties {
  final case class PropertyView(id: UUID, name: String, jurisdiction: Option[String], currency: String, status: String)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no read access to property"))

  /** Authorize against the principal's DB rules, then read what F02 scope allows — in one
    * transaction. The handler is public so tests can exercise the real authz + scope +
    * query path without HTTP plumbing. */
  def list(xa: Transactor[IO], p: Principal): IO[Either[(StatusCode, ApiError), List[PropertyView]]] = {
    val tx: ConnectionIO[(Boolean, List[Property])] = for {
      authz <- Authz.authorizer(p.role)
      allowed = authz.canRead("property")
      props <- if (allowed) PropertyRepo.listForPrincipal(p.userId) else List.empty[Property].pure[ConnectionIO]
    } yield (allowed, props)

    tx.transact(xa).map {
      case (true, props) => Right(props.map(r => PropertyView(r.id, r.name, r.jurisdiction, r.defaultCurrency, r.status)))
      case (false, _)    => Left(forbidden)
    }
  }

  val endpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[PropertyView], Any] =
    sttp.tapir.endpoint.get
      .in("api" / "properties")
      .securityIn(auth.bearer[String]())
      .errorOut(statusCode.and(jsonBody[ApiError]))
      .out(jsonBody[List[PropertyView]])
      .summary("Properties visible to the principal (F03, authz-filtered)")

  def serverEndpoint(a: Auth, xa: Transactor[IO]): ServerEndpoint[Any, IO] =
    endpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (_: Unit) => list(xa, p))
}
