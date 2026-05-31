package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Actions, Authz}
import com.kanzen.bank.{BankAccount, BankRepo, BankTx, TxIn}
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
import scala.util.Try

/** F12 — bank accounts + transactions (AIS read-only; CSV import for marvis). Finance is Principal-private with the
  * Manager operational carve-out: Manager/Principal read + import; Staff have no access. Kanzen never moves money.
  */
object Bank {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class AccountView(id: UUID, name: String, currency: String, kind: Option[String])
  final case class TxView(
      id: UUID,
      providerTxId: Option[String],
      bookedOn: Option[LocalDate],
      amountMinor: Long,
      currency: String,
      direction: String,
      description: Option[String],
      merchant: Option[String],
      reconciliationState: String
  )
  final case class ImportResult(parsed: Int, inserted: Int)

  private def av(a: BankAccount): AccountView = AccountView(a.id, a.name, a.currency, a.kind)
  private def tv(t: BankTx): TxView =
    TxView(
      t.id,
      t.providerTxId,
      t.bookedOn,
      t.amountMinor,
      t.currency,
      t.direction,
      t.description,
      t.merchant,
      t.reconciliationState
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to finance"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such account."))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))

  /** CSV: `provider_tx_id,booked_on,amount_minor,currency,direction,description` (header optional). */
  def parseCsv(text: String): Either[String, List[TxIn]] = {
    val lines = text.split("\r?\n").toList.map(_.trim).filter(_.nonEmpty)
    val rows = lines match {
      case h :: t if h.toLowerCase.contains("provider_tx_id") || h.toLowerCase.contains("amount") => t
      case all => all
    }
    rows.traverse { line =>
      val c = line.split(",", -1).map(_.trim)
      if (c.length < 6) Left(s"bad row (need 6 columns): $line")
      else
        for {
          date <- Try(LocalDate.parse(c(1))).toEither.left.map(_ => s"bad date: ${c(1)}")
          amt <- Try(c(2).toLong).toEither.left.map(_ => s"bad amount: ${c(2)}")
        } yield TxIn(c(0), date, amt, c(3), c(4), c(5))
    }
  }

  def accounts(xa: Transactor[IO], p: Principal): IO[Out[List[AccountView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("bank_account:view"))) (Left(forbidden): Out[List[AccountView]]).pure[ConnectionIO]
      else BankRepo.listAccounts.map(as => Right(as.map(av)): Out[List[AccountView]])
    }
    tx.transact(xa)
  }

  def transactions(xa: Transactor[IO], p: Principal, accountId: UUID): IO[Out[List[TxView]]] = {
    val tx = Authz.forUser(p.userId, p.role).flatMap { authz =>
      if (!authz.can(Actions.byKey("bank_account:view"))) (Left(forbidden): Out[List[TxView]]).pure[ConnectionIO]
      else BankRepo.list(accountId).map(ts => Right(ts.map(tv)): Out[List[TxView]])
    }
    tx.transact(xa)
  }

  def importCsv(xa: Transactor[IO], p: Principal, accountId: UUID, csv: String): IO[Out[ImportResult]] =
    parseCsv(csv) match {
      case Left(err) => IO.pure(Left(badReq(err)))
      case Right(txs) =>
        val tx = for {
          authz <- Authz.forUser(p.userId, p.role)
          exists <- BankRepo.accountExists(accountId)
          res <-
            if (!authz.can(Actions.byKey("bank_account:sync"))) (Left(forbidden): Out[ImportResult]).pure[ConnectionIO]
            else if (!exists) (Left(notFound): Out[ImportResult]).pure[ConnectionIO]
            else BankRepo.ingest(accountId, txs).map(n => Right(ImportResult(txs.size, n)): Out[ImportResult])
        } yield res
        tx.transact(xa)
    }

  // F12 — pull transactions from the connected bank feed (AIS, read-only) and ingest them (idempotent on providerTxId).
  def sync(xa: Transactor[IO], p: Principal, accountId: UUID, feed: com.kanzen.bank.BankFeed): IO[Out[ImportResult]] = {
    val precheck = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- BankRepo.accountExists(accountId)
    } yield (authz.can(Actions.byKey("bank_account:sync")), exists)
    precheck.transact(xa).flatMap {
      case (false, _) => IO.pure(Left(forbidden): Out[ImportResult])
      case (_, false) => IO.pure(Left(notFound): Out[ImportResult])
      case (true, true) =>
        feed.fetch(accountId, java.time.LocalDate.now().minusDays(60)).flatMap { txs =>
          BankRepo.ingest(accountId, txs).transact(xa).map(n => Right(ImportResult(txs.size, n)): Out[ImportResult])
        }
    }
  }

  private val err = statusCode.and(jsonBody[ApiError])

  val accountsEndpoint: Endpoint[String, Unit, (StatusCode, ApiError), List[AccountView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "bank" / "accounts")
      .errorOut(err)
      .out(jsonBody[List[AccountView]])
      .summary("Bank accounts (finance read)")

  val transactionsEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), List[TxView], Any] =
    sttp.tapir.endpoint.get
      .securityIn(auth.bearer[String]())
      .in("api" / "bank" / "accounts" / path[UUID]("id") / "transactions")
      .errorOut(err)
      .out(jsonBody[List[TxView]])
      .summary("Transactions for an account")

  val importEndpoint: Endpoint[String, (UUID, String), (StatusCode, ApiError), ImportResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "bank" / "accounts" / path[UUID]("id") / "import")
      .in(stringBody)
      .errorOut(err)
      .out(jsonBody[ImportResult])
      .summary("Import transactions from CSV (idempotent; Manager+)")

  val syncEndpoint: Endpoint[String, UUID, (StatusCode, ApiError), ImportResult, Any] =
    sttp.tapir.endpoint.post
      .securityIn(auth.bearer[String]())
      .in("api" / "bank" / "accounts" / path[UUID]("id") / "sync")
      .errorOut(err)
      .out(jsonBody[ImportResult])
      .summary("Pull transactions from the connected bank feed (AIS read-only; idempotent; Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    accountsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => accounts(xa, p)),
    transactionsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => transactions(xa, p, id)),
    importEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (id, csv) => importCsv(xa, p, id, csv) }),
    syncEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (id: UUID) => sync(xa, p, id, com.kanzen.bank.StubBankFeed))
  )

  val endpoints: List[AnyEndpoint] = List(accountsEndpoint, transactionsEndpoint, importEndpoint, syncEndpoint)
}
