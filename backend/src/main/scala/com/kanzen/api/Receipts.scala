package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.receipt.{LineItem, Receipt, ReceiptRepo, ReceiptService}
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

/** F13 — receipts + line items (the parsed OCR result; Bedrock parse is a deferred adapter). Each line is
  * brand-normalised → product-level spend (F32). Finance Principal-private with the Manager carve-out (Staff none).
  */
object Receipts {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ReceiptView(
      id: UUID,
      kind: String,
      merchant: Option[String],
      totalMinor: Option[Long],
      currency: Option[String],
      status: String
  )
  final case class LineView(
      id: UUID,
      lineNo: Option[Int],
      description: Option[String],
      totalMinor: Option[Long],
      currency: Option[String],
      brandNorm: Option[String],
      suggestedCategory: Option[String],
      confirmedCategory: Option[String],
      status: String
  )
  final case class ReceiptDetail(receipt: ReceiptView, lines: List[LineView])
  final case class LineIn(
      description: Option[String],
      totalMinor: Option[Long],
      currency: Option[String],
      suggestedCategory: Option[String]
  )
  final case class CreateReq(
      kind: Option[String],
      merchant: Option[String],
      totalMinor: Option[Long],
      currency: Option[String],
      lines: List[LineIn]
  )
  final case class ConfirmReq(category: String)
  final case class SpendResult(brand: String, totalMinor: Long)
  final case class OkResult(ok: Boolean)

  private def rv(r: Receipt): ReceiptView = ReceiptView(r.id, r.kind, r.merchant, r.totalMinor, r.currency, r.status)
  private def lv(l: LineItem): LineView =
    LineView(
      l.id,
      l.lineNo,
      l.description,
      l.totalMinor,
      l.currency,
      l.brandNorm,
      l.suggestedCategory,
      l.confirmedCategory,
      l.status
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to receipts"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such receipt or line."))

  def create(xa: Transactor[IO], p: Principal, req: CreateReq): IO[Out[ReceiptDetail]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("receipt:create"))) (Left(forbidden): Out[ReceiptDetail]).pure[ConnectionIO]
      else
        for {
          r <- ReceiptRepo.create(p.userId, req.kind.getOrElse("receipt"), req.merchant, req.totalMinor, req.currency)
          ls <- req.lines.zipWithIndex.traverse { case (l, i) =>
            val bn = l.description.map(ReceiptService.brandNorm).filter(_.nonEmpty)
            ReceiptRepo.addLine(r.id, Some(i + 1), l.description, l.totalMinor, l.currency, bn, l.suggestedCategory)
          }
          _ <- com.kanzen.events.EventRepo.emit(
            com.kanzen.events.Envelope(
              com.kanzen.events.Events.Receipt.Created,
              com.kanzen.events.Actor.user(p.userId),
              com.kanzen.events.Subject("receipt", r.id),
              p.userId,
              None,
              io.circe.Json.obj(
                "merchant" -> io.circe.Json.fromString(req.merchant.getOrElse("")),
                "totalMinor" -> io.circe.Json.fromLong(req.totalMinor.getOrElse(0L))
              )
            )
          )
        } yield Right(ReceiptDetail(rv(r), ls.map(lv))): Out[ReceiptDetail]
    }
    tx.transact(xa)
  }

  def list(xa: Transactor[IO], p: Principal): IO[Out[List[ReceiptView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("receipt:view"))) (Left(forbidden): Out[List[ReceiptView]]).pure[ConnectionIO]
      else ReceiptRepo.list.map(rs => Right(rs.map(rv)): Out[List[ReceiptView]])
    }
    tx.transact(xa)
  }

  def detail(xa: Transactor[IO], p: Principal, id: UUID): IO[Out[ReceiptDetail]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      r <- ReceiptRepo.get(id)
      ls <- r.fold(List.empty[LineItem].pure[ConnectionIO])(_ => ReceiptRepo.lines(id))
    } yield
      if (!authz.can(Actions.byKey("receipt:view"))) Left(forbidden)
      else r.map(rr => ReceiptDetail(rv(rr), ls.map(lv))).toRight(notFound)
    tx.transact(xa)
  }

  def confirmLine(
      xa: Transactor[IO],
      p: Principal,
      receiptId: UUID,
      lineId: UUID,
      category: String
  ): IO[Out[OkResult]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- ReceiptRepo.lineExists(lineId, receiptId)
      res <-
        if (!authz.can(Actions.byKey("receipt:edit"))) (Left(forbidden): Out[OkResult]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[OkResult]).pure[ConnectionIO]
        else ReceiptRepo.confirmLine(lineId, category).as(Right(OkResult(true)): Out[OkResult])
    } yield res
    tx.transact(xa)
  }

  /** F32 preview — product-level spend across receipt line items by brand. */
  def spend(xa: Transactor[IO], p: Principal, brand: String): IO[Out[SpendResult]] = {
    val key = ReceiptService.brandNorm(brand)
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("receipt:view"))) (Left(forbidden): Out[SpendResult]).pure[ConnectionIO]
      else ReceiptRepo.spendByBrand(key).map(total => Right(SpendResult(key, total)): Out[SpendResult])
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val createEndpoint: Endpoint[String, CreateReq, (StatusCode, ApiError), ReceiptDetail, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "receipts")
      .in(jsonBody[CreateReq])
      .errorOut(err)
      .out(jsonBody[ReceiptDetail])
      .summary("Create a parsed receipt (Manager+)")

  val listEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[ReceiptView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "receipts")
      .errorOut(err)
      .out(jsonBody[List[ReceiptView]])
      .summary("Receipts (finance read)")

  val spendEndpoint: Endpoint[String, String, (StatusCode, ApiError), SpendResult, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "receipts" / "spend")
      .in(query[String]("brand"))
      .errorOut(err)
      .out(jsonBody[SpendResult])
      .summary("Product-level spend by brand (F32)")

  val detailEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), ReceiptDetail, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "receipts" / path[UUID]("id"))
      .errorOut(err)
      .out(jsonBody[ReceiptDetail])
      .summary("A receipt + its line items")

  val confirmEndpoint: Endpoint[String, (UUID, UUID, ConfirmReq), (StatusCode, ApiError), OkResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "receipts" / path[UUID]("id") / "lines" / path[UUID]("lineId") / "confirm")
      .in(jsonBody[ConfirmReq])
      .errorOut(err)
      .out(jsonBody[OkResult])
      .summary("Confirm a line item's category (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    createEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateReq) => create(xa, p, r)),
    listEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => list(xa, p)),
    spendEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (b: String) => spend(xa, p, b)),
    detailEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => detail(xa, p, id)),
    confirmEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, lineId, r) => confirmLine(xa, p, id, lineId, r.category) })
  )

  val endpoints: List[AnyEndpoint] = List(createEndpoint, listEndpoint, spendEndpoint, detailEndpoint, confirmEndpoint)
}
