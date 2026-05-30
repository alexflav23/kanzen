package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Action, Actions, Authz}
import com.kanzen.events.{Actor, Envelope, EventRepo, Events, Subject}
import com.kanzen.finance.{Bill, BillPayment, BillRepo, PayQueueService, PaymentRepo}
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

/** F15 bills & recurring + F16 pay queue. Finance carve-out (Manager+/Principal; Staff none). Invariant: Kanzen never
  * moves money — only `manual` payments can be marked paid (recording reality); auto/review settle externally.
  */
object Finance {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class BillView(
      id: UUID,
      payee: String,
      amountMinor: Long,
      currency: String,
      varianceFlag: Boolean,
      propertyId: Option[UUID],
      category: Option[String]
  )
  final case class CreateBillReq(
      payee: String,
      propertyId: Option[UUID],
      category: Option[String],
      amountMinor: Long,
      currency: String,
      frequency: Option[String]
  )
  final case class SeenReq(seenMinor: Long)
  final case class SeenResult(varianceFlag: Boolean)
  final case class PaymentView(id: UUID, mode: String, state: String)
  final case class QueueItem(id: UUID, amountMinor: Long, currency: String, mode: String, state: String)
  final case class ScheduleReq(
      billId: Option[UUID],
      methodId: Option[UUID],
      amountMinor: Long,
      currency: String,
      mode: String
  )
  final case class MethodReq(
      `type`: String,
      displayName: String,
      last4: Option[String],
      currency: Option[String],
      vaultRef: Option[String]
  )
  final case class MethodView(id: UUID, displayName: String, last4: Option[String])

  private def bv(b: Bill): BillView =
    BillView(b.id, b.payee, b.amountMinor, b.currency, b.varianceFlag, b.propertyId, b.category)
  private def pv(b: BillPayment): PaymentView = PaymentView(b.id, b.mode, b.state)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to finance"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "Not found."))
  private val notMarkable: (StatusCode, ApiError) =
    (
      StatusCode.Conflict,
      ApiError(
        409,
        "not_markable",
        "Kanzen never moves money — only manual payments record reality; auto/review settle externally."
      )
    )

  // F02 v2 — bill + pay-queue actions (the pay queue and payment methods are authorized as part of `bill`).
  private val viewA = Actions.byKey("bill:view")
  private val editA = Actions.byKey("bill:edit")
  private val createA = Actions.byKey("bill:create")
  private val scheduleA = Actions.byKey("bill:schedule")
  private val payA = Actions.byKey("bill:pay")

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(viewA)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A], action: Action = editA): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(action)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  /** F34 — emit a finance event (bill/payment) the realtime layer (F48) uses to live-update the pay queue + bills
    * without a refresh. Money-safe: scheduling/marking records reality, it never moves money.
    */
  private def emitFinance(
      p: Principal,
      eventType: String,
      subject: Subject,
      propertyId: Option[UUID],
      payload: Json
  ): ConnectionIO[Unit] =
    EventRepo.emit(Envelope(eventType, Actor.user(p.userId), subject, p.userId, propertyId, payload)).void

  // ---- bills (F15) ----
  def listBills(xa: Transactor[IO], p: Principal): IO[Out[List[BillView]]] =
    read(p, BillRepo.list(p.tenantId).map(_.map(bv))).transact(xa)
  def createBill(xa: Transactor[IO], p: Principal, r: CreateBillReq): IO[Out[BillView]] =
    write(
      p,
      BillRepo
        .create(p.tenantId, r.payee, r.propertyId, r.category, r.amountMinor, r.currency, r.frequency)
        .flatMap(b =>
          emitFinance(
            p,
            Events.Bill.Created,
            Subject("bill", b.id),
            b.propertyId,
            Json.obj("payee" -> b.payee.asJson, "amountMinor" -> b.amountMinor.asJson, "currency" -> b.currency.asJson)
          ).as(bv(b))
        ),
      createA
    )
      .transact(xa)
  def recordSeen(xa: Transactor[IO], p: Principal, id: UUID, seenMinor: Long): IO[Out[SeenResult]] =
    write(p, BillRepo.recordSeen(id, seenMinor).map(SeenResult)).transact(xa)

  // ---- pay queue (F16) ----
  def queue(xa: Transactor[IO], p: Principal): IO[Out[List[QueueItem]]] =
    read(p, PaymentRepo.queue.map(_.map(q => QueueItem(q.id, q.amountMinor, q.currency, q.mode, q.state)))).transact(xa)
  def schedule(xa: Transactor[IO], p: Principal, r: ScheduleReq): IO[Out[PaymentView]] =
    write(
      p,
      PaymentRepo
        .schedule(r.billId, r.methodId, r.amountMinor, r.currency, r.mode)
        .flatMap(b =>
          emitFinance(
            p,
            Events.Bill.Scheduled,
            Subject("payment", b.id),
            None,
            Json.obj("billId" -> r.billId.asJson, "amountMinor" -> r.amountMinor.asJson, "mode" -> b.mode.asJson)
          ).as(pv(b))
        ),
      scheduleA
    ).transact(xa)
  def createMethod(xa: Transactor[IO], p: Principal, r: MethodReq): IO[Out[MethodView]] =
    write(
      p,
      PaymentRepo
        .createMethod(r.`type`, r.displayName, r.last4, r.currency, r.vaultRef)
        .map(m => MethodView(m.id, m.displayName, m.last4))
    ).transact(xa)
  def listMethods(xa: Transactor[IO], p: Principal): IO[Out[List[MethodView]]] =
    read(p, PaymentRepo.listMethods.map(_.map(m => MethodView(m.id, m.displayName, m.last4)))).transact(xa)

  /** Mark paid — only for manual payments (never moves money). */
  def markPaid(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[PaymentView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      pay <- PaymentRepo.get(id)
      res <- pay match {
        case None => (Left(notFound): Out[PaymentView]).pure[ConnectionIO]
        case Some(bp) =>
          if (!authz.can(payA)) (Left(forbidden): Out[PaymentView]).pure[ConnectionIO]
          else if (!PayQueueService.canMarkPaid(bp.mode)) (Left(notMarkable): Out[PaymentView]).pure[ConnectionIO]
          else
            PaymentRepo.markPaid(id) *>
              emitFinance(
                p,
                Events.Bill.PaidMarked,
                Subject("payment", id),
                None,
                Json.obj("mode" -> bp.mode.asJson)
              ) *>
              PaymentRepo.get(id).map(_.map(pv).toRight(notFound))
      }
    } yield res
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val billsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "bills")
    .errorOut(err)
    .out(jsonBody[List[BillView]])
    .summary("Recurring bills")
  val createBillEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "bills")
    .in(jsonBody[CreateBillReq])
    .errorOut(err)
    .out(jsonBody[BillView])
    .summary("Add a bill (Manager+)")
  val seenEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "bills" / path[UUID]("id") / "seen")
    .in(jsonBody[SeenReq])
    .errorOut(err)
    .out(jsonBody[SeenResult])
    .summary("Record an observed amount (flags >=±15% variance)")
  val queueEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "payments")
    .errorOut(err)
    .out(jsonBody[List[QueueItem]])
    .summary("The pay queue")
  val scheduleEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "payments")
    .in(jsonBody[ScheduleReq])
    .errorOut(err)
    .out(jsonBody[PaymentView])
    .summary("Schedule a payment (Manager+)")
  val markPaidEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "payments" / path[UUID]("id") / "mark-paid")
    .errorOut(err)
    .out(jsonBody[PaymentView])
    .summary("Mark paid (manual only; never moves money)")
  val methodsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "payment-methods")
    .errorOut(err)
    .out(jsonBody[List[MethodView]])
    .summary("Payment methods")
  val createMethodEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "payment-methods")
    .in(jsonBody[MethodReq])
    .errorOut(err)
    .out(jsonBody[MethodView])
    .summary("Add a payment method (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    billsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listBills(xa, p)),
    createBillEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateBillReq) => createBill(xa, p, r)),
    seenEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, r) => recordSeen(xa, p, id, r.seenMinor) }),
    queueEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => queue(xa, p)),
    scheduleEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: ScheduleReq) => schedule(xa, p, r)),
    markPaidEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => markPaid(xa, p, id)),
    methodsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => listMethods(xa, p)),
    createMethodEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: MethodReq) => createMethod(xa, p, r))
  )

  val endpoints: List[AnyEndpoint] =
    List(
      billsEndpoint,
      createBillEndpoint,
      seenEndpoint,
      queueEndpoint,
      scheduleEndpoint,
      markPaidEndpoint,
      methodsEndpoint,
      createMethodEndpoint
    )
}
