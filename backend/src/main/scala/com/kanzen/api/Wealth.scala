package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.ledger.{GeneralLedger, GlRepo}
import com.kanzen.wealth.{Entity, InvestmentRepo, WealthAccount, WealthRepo}
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

/** Wave G (F42 entities · F39 chart of accounts/double-entry · F41 net worth · F43 statements). Entity-scoped books on
  * the F18 ledger; statements derive from gl_splits. **Principal-private** — Manager/Staff get a hard 403 (no leak via
  * totals). The ledger stays hidden (registers only).
  */
object Wealth {
  private type Out[A] = Either[(StatusCode, ApiError), A]
  private val ACCOUNT_TYPES = Set("asset", "liability", "equity", "income", "expense")

  final case class EntityView(
      id: UUID,
      name: String,
      kind: String,
      jurisdiction: Option[String],
      baseCurrency: String,
      parentEntityId: Option[UUID]
  )
  final case class CreateEntityReq(
      name: String,
      kind: String,
      jurisdiction: Option[String],
      baseCurrency: Option[String],
      parentEntityId: Option[UUID]
  )
  final case class AccountView(
      id: UUID,
      code: String,
      name: String,
      accountType: String,
      currency: String,
      balanceMinor: Long,
      subkind: Option[String]
  )
  final case class CreateAccountReq(
      entityId: UUID,
      code: String,
      name: String,
      accountType: String,
      currency: Option[String],
      subkind: Option[String]
  )
  final case class SplitReq(accountId: UUID, amountMinor: Long, memo: Option[String])
  final case class PostReq(
      entityId: Option[UUID],
      kind: String,
      description: Option[String],
      occurredOn: Option[LocalDate],
      splits: List[SplitReq]
  )
  final case class PostResult(transactionId: UUID, balanced: Boolean)
  final case class BalanceSheet(
      entityId: Option[UUID],
      assetsMinor: Long,
      liabilitiesMinor: Long,
      equityMinor: Long,
      balances: Boolean
  )
  final case class IncomeStatement(
      entityId: Option[UUID],
      from: LocalDate,
      to: LocalDate,
      incomeMinor: Long,
      expenseMinor: Long,
      netMinor: Long
  )
  final case class NetWorth(
      entityId: Option[UUID],
      cashAndOtherMinor: Long,
      investmentsMinor: Long,
      assetsMinor: Long,
      liabilitiesMinor: Long,
      netMinor: Long
  )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "Private Wealth is Principal-only"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "not found"))
  private def badReq(m: String): (StatusCode, ApiError) = (StatusCode.BadRequest, ApiError(400, "bad_request", m))
  private val unbalanced: (StatusCode, ApiError) =
    (StatusCode.UnprocessableEntity, ApiError(422, "unbalanced", "splits must sum to zero (double-entry)"))

  private def ev(e: Entity): EntityView =
    EntityView(e.id, e.name, e.kind, e.jurisdiction, e.baseCurrency, e.parentEntityId)
  private def av(a: WealthAccount): AccountView =
    AccountView(a.id, a.code, a.name, a.accountType, a.currency, a.balanceMinor, a.subkind)

  private def principal[A](p: Principal)(q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .authorizer(p.role)
      .flatMap(a =>
        if (a.can(Level.Admin, "wealth")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO]
      )

  def entities(xa: Transactor[IO], p: Principal): IO[Out[List[EntityView]]] =
    principal(p)(WealthRepo.entities(p.userId).map(_.map(ev))).transact(xa)
  def createEntity(xa: Transactor[IO], p: Principal, r: CreateEntityReq): IO[Out[EntityView]] =
    if (r.name.trim.isEmpty) IO.pure(Left(badReq("name required")))
    else
      principal(p)(
        WealthRepo
          .createEntity(p.userId, r.name, r.kind, r.jurisdiction, r.baseCurrency.getOrElse("GBP"), r.parentEntityId)
          .map(id => EntityView(id, r.name, r.kind, r.jurisdiction, r.baseCurrency.getOrElse("GBP"), r.parentEntityId))
      ).transact(xa)

  def accounts(xa: Transactor[IO], p: Principal, entity: Option[UUID]): IO[Out[List[AccountView]]] =
    principal(p)(WealthRepo.accounts(p.userId, entity).map(_.map(av))).transact(xa)
  def createAccount(xa: Transactor[IO], p: Principal, r: CreateAccountReq): IO[Out[AccountView]] =
    if (!ACCOUNT_TYPES.contains(r.accountType))
      IO.pure(Left(badReq(s"type must be one of ${ACCOUNT_TYPES.mkString(", ")}")))
    else
      principal(p)(
        WealthRepo
          .createAccount(p.userId, r.entityId, r.code, r.name, r.accountType, r.currency.getOrElse("GBP"), r.subkind)
          .map(id => AccountView(id, r.code, r.name, r.accountType, r.currency.getOrElse("GBP"), 0L, r.subkind))
      ).transact(xa)

  /** F39 — post a balanced double-entry transaction; unbalanced splits are rejected (422). */
  def post(xa: Transactor[IO], p: Principal, r: PostReq): IO[Out[PostResult]] = {
    val tx = for {
      a <- Authz.authorizer(p.role)
      res <-
        if (!a.can(Level.Admin, "wealth")) (Left(forbidden): Out[PostResult]).pure[ConnectionIO]
        else if (!GeneralLedger.balanced(r.splits.map(_.amountMinor)))
          (Left(unbalanced): Out[PostResult]).pure[ConnectionIO]
        else
          for {
            txn <- GlRepo.insertTransaction(
              p.userId,
              r.kind,
              r.description,
              r.occurredOn.getOrElse(LocalDate.now()),
              None
            )
            _ <- r.splits.traverse_(s => GlRepo.insertSplit(txn, s.accountId, s.amountMinor, s.memo))
          } yield Right(PostResult(txn, balanced = true)): Out[PostResult]
    } yield res
    tx.transact(xa)
  }

  /** F43 — balance sheet from account-type balances; assets = liabilities + equity (incl. retained). */
  def balanceSheet(xa: Transactor[IO], p: Principal, entity: Option[UUID]): IO[Out[BalanceSheet]] =
    principal(p)(WealthRepo.balanceByType(p.userId, entity).map { bt =>
      val assets = bt.getOrElse("asset", 0L)
      val liabilities = -bt.getOrElse("liability", 0L) // credit-normal → owed positive
      val equity =
        -(bt.getOrElse("equity", 0L) + bt.getOrElse("income", 0L) + bt.getOrElse("expense", 0L)) // incl. retained
      BalanceSheet(entity, assets, liabilities, equity, balances = assets == liabilities + equity)
    }).transact(xa)

  /** F43 — income statement over a period. */
  def incomeStatement(
      xa: Transactor[IO],
      p: Principal,
      entity: Option[UUID],
      from: LocalDate,
      to: LocalDate
  ): IO[Out[IncomeStatement]] =
    principal(p)(WealthRepo.flowByType(p.userId, entity, from, to).map { ft =>
      val income = -ft.getOrElse("income", 0L) // credit-normal
      val expense = ft.getOrElse("expense", 0L) // debit-normal
      IncomeStatement(entity, from, to, income, expense, income - expense)
    }).transact(xa)

  /** F41 — consolidated net worth = GL asset balances + investments at market − liabilities. */
  def netWorth(xa: Transactor[IO], p: Principal, entity: Option[UUID]): IO[Out[NetWorth]] =
    principal(p)(for {
      bt <- WealthRepo.balanceByType(p.userId, entity)
      invest <- InvestmentRepo.holdingsValue(p.userId, entity)
      cash = bt.getOrElse("asset", 0L)
      liabilities = -bt.getOrElse("liability", 0L)
      assets = cash + invest
      net = assets - liabilities
      _ <- WealthRepo.saveSnapshot(p.userId, entity, assets, liabilities, net, "GBP")
    } yield NetWorth(entity, cash, invest, assets, liabilities, net)).transact(xa)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val entitiesEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "wealth" / "entities")
    .errorOut(err)
    .out(jsonBody[List[EntityView]])
    .summary("Legal/family entities (books)")
  val createEntityEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "wealth" / "entities")
    .in(jsonBody[CreateEntityReq])
    .errorOut(err)
    .out(jsonBody[EntityView])
    .summary("Create an entity")
  val accountsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "wealth" / "accounts")
    .in(query[Option[UUID]]("entity"))
    .errorOut(err)
    .out(jsonBody[List[AccountView]])
    .summary("Chart of accounts (entity-scoped)")
  val createAccountEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "wealth" / "accounts")
    .in(jsonBody[CreateAccountReq])
    .errorOut(err)
    .out(jsonBody[AccountView])
    .summary("Create a chart-of-accounts entry")
  val postEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "wealth" / "transactions")
    .in(jsonBody[PostReq])
    .errorOut(err)
    .out(jsonBody[PostResult])
    .summary("Post a balanced double-entry transaction")
  val balanceSheetEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "wealth" / "balance-sheet")
    .in(query[Option[UUID]]("entity"))
    .errorOut(err)
    .out(jsonBody[BalanceSheet])
    .summary("Balance sheet")
  val incomeStmtEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "wealth" / "income-statement")
    .in(query[Option[UUID]]("entity"))
    .in(query[LocalDate]("from"))
    .in(query[LocalDate]("to"))
    .errorOut(err)
    .out(jsonBody[IncomeStatement])
    .summary("Income statement (period)")
  val netWorthEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "wealth" / "net-worth")
    .in(query[Option[UUID]]("entity"))
    .errorOut(err)
    .out(jsonBody[NetWorth])
    .summary("Consolidated net worth")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    entitiesEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => entities(xa, p)),
    createEntityEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateEntityReq) => createEntity(xa, p, r)),
    accountsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (e: Option[UUID]) => accounts(xa, p, e)),
    createAccountEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateAccountReq) => createAccount(xa, p, r)),
    postEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: PostReq) => post(xa, p, r)),
    balanceSheetEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (e: Option[UUID]) => balanceSheet(xa, p, e)),
    incomeStmtEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => { case (e, from, to) => incomeStatement(xa, p, e, from, to) }),
    netWorthEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (e: Option[UUID]) => netWorth(xa, p, e))
  )

  val endpoints: List[AnyEndpoint] = List(
    entitiesEndpoint,
    createEntityEndpoint,
    accountsEndpoint,
    createAccountEndpoint,
    postEndpoint,
    balanceSheetEndpoint,
    incomeStmtEndpoint,
    netWorthEndpoint
  )
}
