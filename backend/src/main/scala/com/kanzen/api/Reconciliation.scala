package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.bank.BankRepo
import com.kanzen.finance.ReconciliationRepo
import com.kanzen.receipt.{ReceiptRepo => ReceiptStore}
import doobie.ConnectionIO
import doobie.implicits._
import doobie.util.transactor.Transactor
import io.circe.generic.auto._
import sttp.model.StatusCode
import sttp.tapir._
import sttp.tapir.generic.auto._
import sttp.tapir.json.circe._
import sttp.tapir.server.ServerEndpoint

import java.time.LocalDate
import java.util.UUID

/** F14 — reconciliation: associate a bank transaction with its receipt. The single-spend
  * guarantee — a real payment counts exactly once — is enforced here: a transaction
  * already reconciled cannot be matched again (409). Finance carve-out (Staff none). */
object Reconciliation {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class MatchableTx(id: UUID, bookedOn: Option[LocalDate], amountMinor: Long, currency: String,
                               description: Option[String], merchant: Option[String])
  final case class MatchReq(txnId: UUID, receiptId: UUID)
  final case class MatchResult(matchId: UUID, state: String)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to finance"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such transaction or receipt."))
  private val alreadyMatched: (StatusCode, ApiError) =
    (StatusCode.Conflict, ApiError(409, "already_reconciled", "Transaction is already reconciled (single-spend guarantee)."))

  def unmatched(xa: Transactor[IO], p: Principal, accountId: UUID): IO[Out[List[MatchableTx]]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.canRead("bank_account")) (Left(forbidden): Out[List[MatchableTx]]).pure[ConnectionIO]
      else BankRepo.unmatched(accountId).map(ts =>
        Right(ts.map(t => MatchableTx(t.id, t.bookedOn, t.amountMinor, t.currency, t.description, t.merchant))): Out[List[MatchableTx]])
    }
    tx.transact(xa)
  }

  def matchTxn(xa: Transactor[IO], p: Principal, req: MatchReq): IO[Out[MatchResult]] = {
    val tx = for {
      authz   <- Authz.authorizer(p.role)
      txn     <- BankRepo.findTx(req.txnId)
      receipt <- ReceiptStore.get(req.receiptId)
      res <-
        if (!authz.can(Level.Write, "bank_account")) (Left(forbidden): Out[MatchResult]).pure[ConnectionIO]
        else (txn, receipt) match {
          case (None, _)    => (Left(notFound): Out[MatchResult]).pure[ConnectionIO]
          case (_, None)    => (Left(notFound): Out[MatchResult]).pure[ConnectionIO]
          case (Some(t), Some(_)) =>
            if (t.reconciliationState != "unmatched") (Left(alreadyMatched): Out[MatchResult]).pure[ConnectionIO] // single-spend
            else ReconciliationRepo.matchTxnToReceipt(t.id, req.receiptId, t.amountMinor).map(m => Right(MatchResult(m, "matched")): Out[MatchResult])
        }
    } yield res
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val unmatchedEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[MatchableTx], Any] =
    sttp.tapir.endpoint.get.securityIn(auth.bearer[String]())
      .in("api" / "reconciliation" / "unmatched").in(query[UUID]("account")).errorOut(err).out(jsonBody[List[MatchableTx]])
      .summary("Unmatched transactions for an account")

  val matchEndpoint: Endpoint[String, MatchReq, (StatusCode, ApiError), MatchResult, Any] =
    sttp.tapir.endpoint.post.securityIn(auth.bearer[String]())
      .in("api" / "reconciliation" / "match").in(jsonBody[MatchReq]).errorOut(err).out(jsonBody[MatchResult])
      .summary("Match a transaction to a receipt (single-spend enforced; Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    unmatchedEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (acct: UUID) => unmatched(xa, p, acct)),
    matchEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: MatchReq) => matchTxn(xa, p, r)),
  )

  val endpoints: List[AnyEndpoint] = List(unmatchedEndpoint, matchEndpoint)
}
