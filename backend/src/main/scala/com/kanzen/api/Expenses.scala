package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import com.kanzen.finance.{BudgetRepo, BudgetRow, Expense, ExpenseRepo, ExpenseService}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.Json
import io.circe.generic.auto._
import io.circe.syntax._
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
  private def badReq(msg: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", msg))

  def submit(xa: Transactor[IO], p: Principal, req: SubmitReq): IO[Out[ExpenseView]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("expense:create"))) (Left(forbidden): Out[ExpenseView]).pure[ConnectionIO]
      else
        ExpenseRepo
          .submit(
            p.userId,
            p.tenantId,
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
          .flatMap(e => emitExpense(p, e, Events.Expense.Submitted).as(Right(view(e)): Out[ExpenseView]))
    }
    tx.transact(xa)
  }

  /** F34 — emit an expense-subject event (the realtime layer (F48) live-updates the approvals queue; notifications
    * already fan out off these). Money-safe: an event records a decision, it never settles anything.
    */
  private def emitExpense(p: Principal, e: Expense, eventType: String): ConnectionIO[Unit] =
    EventRepo
      .emit(
        Envelope(
          eventType,
          Actor.user(p.userId),
          Subject("expense", e.id),
          p.userId,
          None,
          Json.obj("payee" -> e.payee.asJson, "amountMinor" -> e.amountMinor.asJson, "currency" -> e.currency.asJson)
        )
      )
      .void

  def list(xa: Transactor[IO], p: Principal, status: Option[String]): IO[Out[List[ExpenseView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("expense:view"))) (Left(forbidden): Out[List[ExpenseView]]).pure[ConnectionIO]
      else ExpenseRepo.list(p.tenantId, status).map(es => Right(es.map(view)): Out[List[ExpenseView]])
    }
    tx.transact(xa)
  }

  /** Approve/reject share the over-threshold → Principal rule. */
  private def decide(
      xa: Transactor[IO],
      p: Principal,
      id: UUID,
      action: (UUID, UUID, UUID) => ConnectionIO[Int], // (id, tenantId, by)
      eventType: String
  ): IO[Out[ExpenseView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exp <- ExpenseRepo.get(id, p.tenantId)
      res <- exp match {
        case None => (Left(notFound): Out[ExpenseView]).pure[ConnectionIO]
        case Some(e) =>
          if (!authz.can(Actions.byKey("expense:approve"))) (Left(forbidden): Out[ExpenseView]).pure[ConnectionIO]
          else if (ExpenseService.needsApproval(e.amountMinor, e.currency) && p.role != "principal")
            (Left(needsPrincipal): Out[ExpenseView]).pure[ConnectionIO]
          else
            action(id, p.tenantId, p.userId) *> emitExpense(p, e, eventType) *>
              ExpenseRepo.get(id, p.tenantId).map(_.map(view).toRight(notFound))
      }
    } yield res
    tx.transact(xa)
  }

  def approve(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ExpenseView]] =
    decide(xa, p, id, ExpenseRepo.approve, Events.Expense.Approved)
  def reject(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ExpenseView]] =
    decide(xa, p, id, ExpenseRepo.reject, Events.Expense.Rejected)

  // ---- budgets (F17) ----
  final case class BudgetView(
      id: UUID,
      propertyId: Option[UUID],
      propertyName: Option[String],
      categoryId: Option[UUID],
      categoryName: Option[String],
      period: String,
      amountMinor: Long,
      actualMinor: Long,
      currency: String
  )
  final case class CreateBudgetReq(
      propertyId: Option[UUID],
      categoryId: Option[UUID],
      period: String,
      amountMinor: Long,
      currency: String
  )
  final case class DeletedResp(deleted: UUID)

  private def bView(b: BudgetRow): BudgetView =
    BudgetView(
      b.id,
      b.propertyId,
      b.propertyName,
      b.categoryId,
      b.categoryName,
      b.period,
      b.amountMinor,
      b.actualMinor,
      b.currency
    )

  def listBudgets(xa: Transactor[IO], p: Principal): IO[Out[List[BudgetView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("expense:view"))) (Left(forbidden): Out[List[BudgetView]]).pure[ConnectionIO]
      else BudgetRepo.list.map(bs => Right(bs.map(bView)): Out[List[BudgetView]])
    }
    tx.transact(xa)
  }

  def createBudget(xa: Transactor[IO], p: Principal, req: CreateBudgetReq): IO[Out[BudgetView]] = {
    if (!BudgetRepo.validPeriod(req.period)) IO.pure(Left(badReq("period must be monthly, quarterly or annually")))
    else if (req.amountMinor <= 0) IO.pure(Left(badReq("budget amount must be positive")))
    else {
      val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
        if (!authz.can(Actions.byKey("expense:create"))) (Left(forbidden): Out[BudgetView]).pure[ConnectionIO]
        else
          BudgetRepo
            .create(p.userId, req.propertyId, req.categoryId, req.period, req.amountMinor, req.currency)
            .flatMap(id => BudgetRepo.find(id).map(_.map(bView).toRight(notFound)))
      }
      tx.transact(xa)
    }
  }

  def deleteBudget(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[DeletedResp]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("expense:create"))) (Left(forbidden): Out[DeletedResp]).pure[ConnectionIO]
      else BudgetRepo.softDelete(id).map(n => if (n > 0) Right(DeletedResp(id)) else Left(notFound))
    }
    tx.transact(xa)
  }

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

  val budgetsEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[BudgetView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "budgets")
      .errorOut(err)
      .out(jsonBody[List[BudgetView]])
      .summary("Budgets with budget-vs-actual (approved expenses in the period)")

  val createBudgetEndpoint: Endpoint[String, CreateBudgetReq, (StatusCode, ApiError), BudgetView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "budgets")
      .in(jsonBody[CreateBudgetReq])
      .errorOut(err)
      .out(jsonBody[BudgetView])
      .summary("Add a budget (Manager+)")

  val deleteBudgetEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), DeletedResp, Any] =
    sttp.tapir.endpoint.delete
      .securityIn(auth.bearer[String]())
      .in("api" / "budgets" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[DeletedResp])
      .summary("Delete a budget (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    submitEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: SubmitReq) => submit(xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (s: Option[String]) => list(xa, p, s)),
    approveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => approve(xa, p, id)),
    rejectEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => reject(xa, p, id)),
    budgetsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listBudgets(xa, p)),
    createBudgetEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateBudgetReq) => createBudget(xa, p, r)),
    deleteBudgetEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => deleteBudget(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(
      submitEndpoint,
      listEndpoint,
      approveEndpoint,
      rejectEndpoint,
      budgetsEndpoint,
      createBudgetEndpoint,
      deleteBudgetEndpoint
    )
}
