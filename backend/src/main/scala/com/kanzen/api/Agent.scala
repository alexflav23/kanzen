package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.agent.{AgentActionRow, AgentRepo, AgentService, TrustRepo, TrustService}
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.inbox.InboxRepo
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

/** F25 email-agent pipeline + F27 trust model + F26 unified inbox. Mail is ingested,
  * classified (rules in sandbox; Bedrock in prod) and mapped to **proposed** actions — never
  * auto-committed for financial/asset categories (F27 lock, SPEC §10.3 / house rule). Human
  * confirm/reject goes through the same Authorizer as any other write. */
object Agent {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class IngestReq(mailbox: String, from: String, subject: String)
  final case class IngestResult(emailId: UUID, category: String, proposedActionIds: List[UUID])
  final case class ActionView(id: UUID, actionType: String, status: String, category: Option[String], subject: Option[String], locked: Boolean)
  final case class TrustView(category: String, routing: String, locked: Boolean)
  final case class SetTrustReq(category: String, routing: String)
  final case class InboxView(counts: Map[String, Long], total: Long)
  final case class Ok(ok: Boolean)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no agent access"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such action."))
  private def conflict(m: String): (StatusCode, ApiError) = (StatusCode.Conflict, ApiError(409, "conflict", m))

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.canRead("agent")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.can(Level.Write, "agent")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  /** Ingest an email → classify → propose its mapped actions (all start `proposed`). */
  def ingest(xa: Transactor[IO], p: Principal, r: IngestReq): IO[Out[IngestResult]] =
    write(p, for {
      ing <- AgentRepo.ingest(r.mailbox, r.from, r.subject)
      (emailId, category) = ing
      ids <- AgentService.proposedActions(category).traverse(a => AgentRepo.propose(emailId, a))
    } yield IngestResult(emailId, category, ids)).transact(xa)

  def actions(xa: Transactor[IO], p: Principal, status: String): IO[Out[List[ActionView]]] =
    read(p, AgentRepo.listActions(status).map(_.map(av))).transact(xa)
  private def av(a: AgentActionRow): ActionView =
    ActionView(a.id, a.actionType, a.status, a.category, a.subject, locked = a.category.exists(TrustService.locked))

  /** Human confirm — the review step. Allowed for any category (incl. locked financial ones);
    * it's the human review the lock requires. Goes through the agent-write authz path. */
  def confirm(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    actOn(xa, p, id, execute = true)
  def reject(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] =
    actOn(xa, p, id, execute = false)

  private def actOn(xa: Transactor[IO], p: Principal, id: UUID, execute: Boolean): IO[Out[Ok]] = {
    val tx = for {
      a   <- Authz.authorizer(p.role)
      cat <- AgentRepo.actionCategory(id)
      res <-
        if (!a.can(Level.Write, "agent")) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else cat match {
          case None => (Left(notFound): Out[Ok]).pure[ConnectionIO]
          case Some((_, status)) if status != "proposed" => (Left(conflict(s"action already $status")): Out[Ok]).pure[ConnectionIO]
          case Some(_) => (if (execute) AgentRepo.confirm(id) else AgentRepo.reject(id)).map(n => Right(Ok(n > 0)): Out[Ok])
        }
    } yield res
    tx.transact(xa)
  }

  /** F27 — attempt to AUTO-execute (no human review). Blocked (409) for locked financial/asset
    * categories: those can never be auto-committed, regardless of trust routing. */
  def autoExecute(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[Ok]] = {
    val tx = for {
      a   <- Authz.authorizer(p.role)
      cat <- AgentRepo.actionCategory(id)
      res <-
        if (!a.can(Level.Write, "agent")) (Left(forbidden): Out[Ok]).pure[ConnectionIO]
        else cat match {
          case None => (Left(notFound): Out[Ok]).pure[ConnectionIO]
          case Some((category, _)) =>
            TrustRepo.get(category).flatMap { routing =>
              if (!TrustService.canAutoExecute(category, routing.getOrElse("review")))
                (Left(conflict(s"'$category' is locked to review — never auto-committed")): Out[Ok]).pure[ConnectionIO]
              else AgentRepo.confirm(id).map(n => Right(Ok(n > 0)): Out[Ok])
            }
        }
    } yield res
    tx.transact(xa)
  }

  def trust(xa: Transactor[IO], p: Principal): IO[Out[List[TrustView]]] =
    read(p, TrustRepo.all.map(_.map { case (c, r, l) => TrustView(c, r, l) })).transact(xa)
  def setTrust(xa: Transactor[IO], p: Principal, r: SetTrustReq): IO[Out[TrustView]] =
    write(p, TrustRepo.set(r.category, r.routing).map(eff => TrustView(r.category, eff, TrustService.locked(r.category)))).transact(xa)

  def inbox(xa: Transactor[IO], p: Principal): IO[Out[InboxView]] =
    read(p, InboxRepo.counts.map(c => InboxView(c, c.values.sum))).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val ingestEndpoint  = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "agent" / "ingest").in(jsonBody[IngestReq]).errorOut(err).out(jsonBody[IngestResult]).summary("Ingest + classify an email → propose actions")
  val actionsEndpoint = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "agent" / "actions").in(query[String]("status").default("proposed")).errorOut(err).out(jsonBody[List[ActionView]]).summary("Agent actions by status (Triage)")
  val confirmEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "agent" / "actions" / path[UUID]("id") / "confirm").errorOut(err).out(jsonBody[Ok]).summary("Confirm (human review) an action")
  val rejectEndpoint  = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "agent" / "actions" / path[UUID]("id") / "reject").errorOut(err).out(jsonBody[Ok]).summary("Reject an action")
  val autoEndpoint    = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "agent" / "actions" / path[UUID]("id") / "auto-execute").errorOut(err).out(jsonBody[Ok]).summary("Attempt auto-execute (blocked for locked categories)")
  val trustEndpoint   = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "agent" / "trust").errorOut(err).out(jsonBody[List[TrustView]]).summary("Trust routing per category")
  val setTrustEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "agent" / "trust").in(jsonBody[SetTrustReq]).errorOut(err).out(jsonBody[TrustView]).summary("Set a category's routing (financial forced to review)")
  val inboxEndpoint   = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "inbox").errorOut(err).out(jsonBody[InboxView]).summary("Unified inbox counts")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    ingestEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: IngestReq) => ingest(xa, p, r)),
    actionsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (s: String) => actions(xa, p, s)),
    confirmEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => confirm(xa, p, id)),
    rejectEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => reject(xa, p, id)),
    autoEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => autoExecute(xa, p, id)),
    trustEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => trust(xa, p)),
    setTrustEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SetTrustReq) => setTrust(xa, p, r)),
    inboxEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => inbox(xa, p)),
  )

  val endpoints: List[AnyEndpoint] = List(ingestEndpoint, actionsEndpoint, confirmEndpoint, rejectEndpoint, autoEndpoint, trustEndpoint, setTrustEndpoint, inboxEndpoint)
}
