package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.ledger.{GeneralLedger, GlRepo}
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

/** F18 / ADR-001 — the Postgres double-entry general ledger. Principal-private (ledger = none for Manager/Staff).
  * Postings are balanced-or-rejected; corrections are reversing transactions (originals immutable). The UI never shows
  * raw postings — only balances and registers (statements).
  */
object Ledger {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class AccountReq(code: String, name: String, accountType: String, currency: String)
  final case class AccountView(id: UUID, code: String, name: String, accountType: String, currency: String)
  final case class SplitIn(accountId: UUID, amountMinor: Long, memo: Option[String])
  final case class PostReq(
      kind: String,
      description: Option[String],
      occurredOn: Option[LocalDate],
      splits: List[SplitIn]
  )
  final case class PostResult(transactionId: UUID)
  final case class BalanceResult(accountId: UUID, balanceMinor: Long)
  final case class RegisterRowView(
      transactionId: UUID,
      kind: String,
      description: Option[String],
      occurredOn: LocalDate,
      amountMinor: Long,
      memo: Option[String]
  )
  final case class ReverseResult(reversalTransactionId: UUID)

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "the general ledger is Principal-only"))
  private val notFound: (StatusCode, ApiError) =
    (StatusCode.NotFound, ApiError(404, "not_found", "No such transaction."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  def createAccount(xa: Transactor[IO], p: Principal, req: AccountReq): IO[Out[AccountView]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.can(Level.Write, "ledger")) (Left(forbidden): Out[AccountView]).pure[ConnectionIO]
      else
        GlRepo
          .createAccount(p.userId, req.code, req.name, req.accountType, req.currency)
          .map(a => Right(AccountView(a.id, a.code, a.name, a.accountType, a.currency)): Out[AccountView])
    }
    tx.transact(xa)
  }

  def post(xa: Transactor[IO], p: Principal, req: PostReq): IO[Out[PostResult]] = {
    if (!GeneralLedger.balanced(req.splits.map(_.amountMinor)))
      IO.pure(Left(badReq("transaction does not balance — signed splits must sum to zero (≥2 splits, ≥1 non-zero)")))
    else {
      val tx = for {
        authz <- Authz.authorizer(p.role)
        accountsOk <- req.splits.map(_.accountId).distinct.traverse(GlRepo.accountExists).map(_.forall(identity))
        res <-
          if (!authz.can(Level.Write, "ledger")) (Left(forbidden): Out[PostResult]).pure[ConnectionIO]
          else if (!accountsOk) (Left(badReq("unknown ledger account")): Out[PostResult]).pure[ConnectionIO]
          else
            for {
              t <- GlRepo.insertTransaction(
                p.userId,
                req.kind,
                req.description,
                req.occurredOn.getOrElse(LocalDate.now()),
                None
              )
              _ <- req.splits.traverse_(s => GlRepo.insertSplit(t, s.accountId, s.amountMinor, s.memo))
            } yield Right(PostResult(t)): Out[PostResult]
      } yield res
      tx.transact(xa)
    }
  }

  def reverse(xa: Transactor[IO], p: Principal, txnId: UUID): IO[Out[ReverseResult]] = {
    val tx = for {
      authz <- Authz.authorizer(p.role)
      exists <- GlRepo.transactionExists(txnId)
      splits <- if (exists) GlRepo.splitsOf(txnId) else List.empty[(UUID, Long, Option[String])].pure[ConnectionIO]
      res <-
        if (!authz.can(Level.Write, "ledger")) (Left(forbidden): Out[ReverseResult]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[ReverseResult]).pure[ConnectionIO]
        else
          for {
            r <- GlRepo.insertTransaction(
              p.userId,
              "reversal",
              Some(s"Reversal of $txnId"),
              LocalDate.now(),
              Some(txnId)
            )
            _ <- splits.traverse_ { case (acc, amt, memo) => GlRepo.insertSplit(r, acc, -amt, memo) }
          } yield Right(ReverseResult(r)): Out[ReverseResult]
    } yield res
    tx.transact(xa)
  }

  def balance(xa: Transactor[IO], p: Principal, accountId: UUID): IO[Out[BalanceResult]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.can(Level.Read, "ledger")) (Left(forbidden): Out[BalanceResult]).pure[ConnectionIO]
      else GlRepo.balanceOf(accountId).map(b => Right(BalanceResult(accountId, b)): Out[BalanceResult])
    }
    tx.transact(xa)
  }

  def register(xa: Transactor[IO], p: Principal, accountId: UUID): IO[Out[List[RegisterRowView]]] = {
    val tx = Authz.authorizer(p.role).flatMap { authz =>
      if (!authz.can(Level.Read, "ledger")) (Left(forbidden): Out[List[RegisterRowView]]).pure[ConnectionIO]
      else
        GlRepo
          .register(accountId)
          .map(rs =>
            Right(
              rs.map(r => RegisterRowView(r.transactionId, r.kind, r.description, r.occurredOn, r.amountMinor, r.memo))
            ): Out[List[RegisterRowView]]
          )
    }
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val accountEndpoint: Endpoint[String, AccountReq, (StatusCode, ApiError), AccountView, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "ledger" / "accounts")
      .in(jsonBody[AccountReq])
      .errorOut(err)
      .out(jsonBody[AccountView])
      .summary("Create a ledger account (Principal-only)")

  val postEndpoint: Endpoint[String, PostReq, (StatusCode, ApiError), PostResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "ledger" / "transactions")
      .in(jsonBody[PostReq])
      .errorOut(err)
      .out(jsonBody[PostResult])
      .summary("Post a balanced transaction (Principal-only)")

  val reverseEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), ReverseResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "ledger" / "transactions" / path[UUID]("id") / "reverse")
      .errorOut(err)
      .out(jsonBody[ReverseResult])
      .summary("Reverse a transaction (immutable correction)")

  val balanceEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), BalanceResult, Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "ledger" / "accounts" / path[UUID]("id") / "balance")
      .errorOut(err)
      .out(jsonBody[BalanceResult])
      .summary("Derived account balance (Principal-only)")

  val registerEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[RegisterRowView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "ledger" / "accounts" / path[UUID]("id") / "register")
      .errorOut(err)
      .out(jsonBody[List[RegisterRowView]])
      .summary("Account register (Principal-only)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    accountEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: AccountReq) => createAccount(xa, p, r)),
    postEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: PostReq) => post(xa, p, r)),
    reverseEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => reverse(xa, p, id)),
    balanceEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => balance(xa, p, id)),
    registerEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => register(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(accountEndpoint, postEndpoint, reverseEndpoint, balanceEndpoint, registerEndpoint)
}
