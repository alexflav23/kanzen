package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Action, Actions, Authz}
import com.kanzen.lists.{ListItem, ListRepo, ShoppingList}
import com.kanzen.people.{AssigneeScope, PeopleRepo}
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

/** F08 — shopping lists + items. Staff propose (non-recurring proposals need approval); Manager/Principal manage +
  * approve. Items carry a buy URL (never a payment).
  */
object Lists {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ListView(
      id: UUID,
      name: String,
      vendor: Option[String],
      propertyId: Option[UUID],
      `type`: String,
      cycle: Option[String],
      nextOrder: Option[LocalDate],
      status: String,
      priority: String,
      assigneeId: Option[UUID]
  )
  final case class ItemView(
      id: UUID,
      name: String,
      qty: Int,
      status: String,
      recurring: Boolean,
      url: Option[String],
      category: Option[String],
      note: Option[String],
      estPriceMinor: Option[Long],
      currency: Option[String],
      addedBy: Option[String],
      substituteFor: Option[UUID]
  )
  final case class CreateListReq(name: String, vendor: Option[String], propertyId: Option[UUID])
  final case class EditListReq(
      name: String,
      vendor: Option[String],
      propertyId: Option[UUID],
      cycle: Option[String],
      nextOrder: Option[LocalDate],
      `type`: String,
      priority: Option[String] = None,
      assigneeId: Option[UUID] = None
  )

  // accepted priority levels (urgent → low); anything else normalises to normal
  private val priorities = Set("urgent", "high", "normal", "low")
  private def normPriority(p: Option[String]): String = p.map(_.toLowerCase).filter(priorities).getOrElse("normal")
  final case class AddItemReq(
      name: String,
      qty: Option[Int],
      recurring: Option[Boolean],
      url: Option[String],
      category: Option[String] = None,
      note: Option[String] = None,
      estPriceMinor: Option[Long] = None,
      substituteFor: Option[UUID] = None
  )

  private def lv(l: ShoppingList): ListView =
    ListView(l.id, l.name, l.vendor, l.propertyId, l.`type`, l.cycle, l.nextOrder, l.status, l.priority, l.assigneeId)
  private def iv(i: ListItem): ItemView =
    ItemView(
      i.id,
      i.name,
      i.qty,
      i.status,
      i.recurring,
      i.url,
      i.category,
      i.note,
      i.estPriceMinor,
      i.currency,
      i.addedBy,
      i.substituteFor
    )

  private val forbidden: (StatusCode, ApiError) =
    (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to lists"))
  private val notFound: (StatusCode, ApiError) = (StatusCode.NotFound, ApiError(404, "not_found", "No such list item."))

  // F02 v2 — list actions (view/create/edit + the operational verbs approve/order). `write` defaults to list:edit;
  // specific endpoints pass their own verb so a permission set can grant e.g. order-only without edit.
  private val viewA = Actions.byKey("list:view")
  private val editA = Actions.byKey("list:edit")
  private val createA = Actions.byKey("list:create")
  private val approveA = Actions.byKey("list:approve")
  private val orderA = Actions.byKey("list:order")

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(viewA)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A], action: Action = editA): ConnectionIO[Out[A]] =
    Authz
      .forUser(p.userId, p.role)
      .flatMap(a => if (a.can(action)) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  // Staff are scoped to runs assigned to them (or unassigned in their property); Manager/Principal see all.
  private def staffScope(p: Principal): ConnectionIO[Option[AssigneeScope]] =
    if (p.role == "staff") PeopleRepo.assigneeScope(p.userId) else Option.empty[AssigneeScope].pure[ConnectionIO]

  def lists(xa: Transactor[IO], p: Principal): IO[Out[List[ListView]]] =
    read(p, staffScope(p).flatMap(sc => ListRepo.lists(sc)).map(_.map(lv))).transact(xa)
  def createList(xa: Transactor[IO], p: Principal, r: CreateListReq): IO[Out[ListView]] =
    write(
      p,
      ListRepo
        .createList(r.propertyId, r.name, r.vendor)
        .map(id => ListView(id, r.name, r.vendor, r.propertyId, "grocery", None, None, "active", "normal", None)),
      createA
    ).transact(xa)

  /** Reconfigure a list (Manager+). */
  def update(xa: Transactor[IO], p: Principal, listId: UUID, r: EditListReq): IO[Out[ListView]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- ListRepo.listExists(listId)
      res <-
        if (!authz.can(editA)) (Left(forbidden): Out[ListView]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[ListView]).pure[ConnectionIO]
        else {
          val pr = normPriority(r.priority)
          ListRepo
            .update(listId, r.name, r.propertyId, r.vendor, r.cycle, r.nextOrder, r.`type`, pr, r.assigneeId)
            .as(
              Right(
                ListView(
                  listId,
                  r.name,
                  r.vendor,
                  r.propertyId,
                  r.`type`,
                  r.cycle,
                  r.nextOrder,
                  "active",
                  pr,
                  r.assigneeId
                )
              ): Out[ListView]
            )
        }
    } yield res
    tx.transact(xa)
  }

  def items(xa: Transactor[IO], p: Principal, listId: UUID): IO[Out[List[ItemView]]] =
    read(p, ListRepo.items(listId).map(_.map(iv))).transact(xa)

  /** Add an item; a Staff-proposed non-recurring item lands as needs_approval. */
  def addItem(xa: Transactor[IO], p: Principal, listId: UUID, r: AddItemReq): IO[Out[ItemView]] =
    write(
      p,
      ListRepo
        .addItem(
          listId,
          r.name,
          r.qty.getOrElse(1),
          r.recurring.getOrElse(false),
          r.url,
          r.category,
          r.note,
          r.estPriceMinor,
          Some(p.userId),
          p.role == "staff",
          r.substituteFor
        )
        .map(iv)
    ).transact(xa)

  /** Approve/decline — Manager/Principal only (Staff can't approve their own proposals). */
  private def decide(xa: Transactor[IO], p: Principal, itemId: UUID, op: UUID => ConnectionIO[Int]): IO[Out[Unit]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- ListRepo.itemExists(itemId)
      res <-
        if (!authz.can(approveA) || p.role == "staff") (Left(forbidden): Out[Unit]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
        else op(itemId).as(Right(()): Out[Unit])
    } yield res
    tx.transact(xa)
  }
  def approve(xa: Transactor[IO], p: Principal, itemId: UUID): IO[Out[Unit]] = decide(xa, p, itemId, ListRepo.approve)
  def decline(xa: Transactor[IO], p: Principal, itemId: UUID): IO[Out[Unit]] = decide(xa, p, itemId, ListRepo.decline)

  /** Place the order — rolls next-order forward by the list's cycle (Manager+). */
  def placeOrder(xa: Transactor[IO], p: Principal, listId: UUID): IO[Out[Unit]] = {
    val tx = for {
      authz <- Authz.forUser(p.userId, p.role)
      exists <- ListRepo.listExists(listId)
      res <-
        if (!authz.can(orderA)) (Left(forbidden): Out[Unit]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
        else ListRepo.placeOrder(listId).as(Right(()): Out[Unit])
    } yield res
    tx.transact(xa)
  }

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val listsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "lists")
    .errorOut(err)
    .out(jsonBody[List[ListView]])
    .summary("Shopping lists")
  val createListEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "lists")
    .in(jsonBody[CreateListReq])
    .errorOut(err)
    .out(jsonBody[ListView])
    .summary("Create a list")
  val editListEndpoint = sttp.tapir.endpoint.patch
    .securityIn(bearer)
    .in("api" / "lists" / path[UUID]("id"))
    .in(jsonBody[EditListReq])
    .errorOut(err)
    .out(jsonBody[ListView])
    .summary("Reconfigure a list — property/vendor/cycle/next-order (Manager+)")
  val itemsEndpoint = sttp.tapir.endpoint.get
    .securityIn(bearer)
    .in("api" / "lists" / path[UUID]("id") / "items")
    .errorOut(err)
    .out(jsonBody[List[ItemView]])
    .summary("List items")
  val addItemEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "lists" / path[UUID]("id") / "items")
    .in(jsonBody[AddItemReq])
    .errorOut(err)
    .out(jsonBody[ItemView])
    .summary("Propose/add an item")
  val approveEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "list-items" / path[UUID]("id") / "approve")
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Approve an item (Manager+)")
  val declineEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "list-items" / path[UUID]("id") / "decline")
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Decline an item (Manager+)")
  val placeOrderEndpoint = sttp.tapir.endpoint.post
    .securityIn(bearer)
    .in("api" / "lists" / path[UUID]("id") / "order")
    .errorOut(err)
    .out(jsonBody[Unit])
    .summary("Place the order — roll the cycle forward (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => lists(xa, p)),
    createListEndpoint
      .serverSecurityLogic(a.securityLogic)
      .serverLogic(p => (r: CreateListReq) => createList(xa, p, r)),
    editListEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => update(xa, p, id, r) }),
    itemsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => items(xa, p, id)),
    addItemEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addItem(xa, p, id, r) }),
    approveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => approve(xa, p, id)),
    declineEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => decline(xa, p, id)),
    placeOrderEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => placeOrder(xa, p, id))
  )

  val endpoints: List[AnyEndpoint] =
    List(
      listsEndpoint,
      createListEndpoint,
      editListEndpoint,
      itemsEndpoint,
      addItemEndpoint,
      approveEndpoint,
      declineEndpoint,
      placeOrderEndpoint
    )
}
