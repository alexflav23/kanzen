package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.finance.{Expense, ExpenseRepo, ExpenseService}
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

/** F17 — budgets, expenses & approvals. Manager submits + decides under threshold; over-threshold routes to the
  * Principal (per-jurisdiction native thresholds, no FX). Deductibility/VAT flags ride along (F38). Finance carve-out
  * (Staff none).
  */
object Expenses {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ExpenseView(
      id: UUID,
      payee: Option[String],
      amountMinor: Long,
      currency: String,
      status: String,
      deductible: Boolean,
      vatReclaimable: Boolean
  )
  final case class SubmitReq(
      payee: Option[String],
      description: Option[String],
      amountMinor: Long,
      currency: String,
      propertyId: Option[UUID],
      categoryId: Option[UUID],
      deductible: Option[Boolean],
      vatReclaimable: Option[Boolean],
      taxCategory: Option[String]
  )

  private def view(e: Expense): ExpenseView =
    ExpenseView(e.id, e.payee, e.amountMinor, e.currency, e.status, e.deductible, e.vatReclaimable)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to expenses"))
  private val needsPrincipal: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "approval_threshold", "over-threshold approval requires the Principal"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such expense."))

  def submit(xa: Transactor[IO], p: Principal, req: SubmitReq): IO[Out[ExpenseView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Level.Write, "expense")) (Left(forbidden): Out[ExpenseView]).pure[ConnectionIO]
      else
        ExpenseRepo
          .submit(
            p.userId,
            req.payee,
            req.description,
            req.amountMinor,
            req.currency,
            req.propertyId,
            req.categoryId,
            req.deductible.getOrElse(false),
            req.vatReclaimable.getOrElse(false),
            req.taxCategory,
            p.userId
          )
          .map(e => Right(view(e)): Out[ExpenseView])
    }
    tx.transact(xa)
  }

  def list(xa: Transactor[IO], p: Principal, status: Option[String]): IO[Out[List[ExpenseView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.canRead("expense")) (Left(forbidden): Out[List[ExpenseView]]).pure[ConnectionIO]
      else ExpenseRepo.list(status).map(es => Right(es.map(view)): Out[List[ExpenseView]])
    }
    tx.transact(xa)
  }

  /** Approve/reject share the over-threshold → Principal rule. */
  private def decide(
      xa: Transactor[IO],
      p: Principal,
      id: UUID,
      action: (UUID, UUID) => ConnectionIO[Int]
  ): IO[Out[ExpenseView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exp <- ExpenseRepo.get(id)
      res <- exp match {
        case None => (Left(notFound): Out[ExpenseView]).pure[ConnectionIO]
        case Some(e) =>
          if (!authz.can(Level.Write, "expense")) (Left(forbidden): Out[ExpenseView]).pure[ConnectionIO]
          else if (ExpenseService.needsApproval(e.amountMinor, e.currency) && p.role != "principal")
            (Left(needsPrincipal): Out[ExpenseView]).pure[ConnectionIO]
          else action(id, p.userId) *> ExpenseRepo.get(id).map(_.map(view).toRight(notFound))
      }
    } yield res
    tx.transact(xa)
  }

  def approve(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ExpenseView]] = decide(xa, p, id, ExpenseRepo.approve)
  def reject(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ExpenseView]] = decide(xa, p, id, ExpenseRepo.reject)

  private val err = statusCode.and(jsonBody[ApiError])

  val submitEndpoint: Endpoint[String, SubmitReq, (StatusCode, ApiError), ExpenseView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "expenses")
      .in(jsonBody[SubmitReq])
      .errorOut(err)
      .out(jsonBody[ExpenseView])
      .summary("Submit an expense (Manager+; threshold-routed)")

  val listEndpoint: Endpoint[String, Option[String], (StatusCode, ApiError), List[ExpenseView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "expenses")
      .in(query[Option[String]]("status"))
      .errorOut(err)
      .out(jsonBody[List[ExpenseView]])
      .summary("Expenses (finance read; ?status=)")

  val approveEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), ExpenseView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "expenses" / path[UUID]("id") / "approve")
      .errorOut(err)
      .out(jsonBody[ExpenseView])
      .summary("Approve (over-threshold → Principal)")

  val rejectEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), ExpenseView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "expenses" / path[UUID]("id") / "reject")
      .errorOut(err)
      .out(jsonBody[ExpenseView])
      .summary("Reject (over-threshold → Principal)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    submitEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SubmitReq) => submit(xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (s: Option[String]) => list(xa, p, s)),
    approveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => approve(xa, p, id)),
    rejectEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => reject(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] = List(submitEndpoint, listEndpoint, approveEndpoint, rejectEndpoint)
}
