package com.kanzen.api

import cats.effect.IO
import cats.syntax.all._
import com.kanzen.auth.{Auth, Principal}
import com.kanzen.authz.{Authz, Level}
import com.kanzen.lists.{ListItem, ListRepo, ShoppingList}
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

/** F08 — shopping lists + items. Staff propose (non-recurring proposals need approval);
  * Manager/Principal manage + approve. Items carry a buy URL (never a payment). */
object Lists {
  private type Out[A] = Either[(StatusCode, ApiError), A]

  final case class ListView(id: UUID, name: String, vendor: Option[String], propertyId: Option[UUID])
  final case class ItemView(id: UUID, name: String, qty: Int, status: String, recurring: Boolean, url: Option[String])
  final case class CreateListReq(name: String, vendor: Option[String], propertyId: Option[UUID])
  final case class AddItemReq(name: String, qty: Option[Int], recurring: Option[Boolean], url: Option[String])

  private def lv(l: ShoppingList): ListView = ListView(l.id, l.name, l.vendor, l.propertyId)
  private def iv(i: ListItem): ItemView = ItemView(i.id, i.name, i.qty, i.status, i.recurring, i.url)

  private val forbidden: (StatusCode, ApiError) = (StatusCode.Forbidden, ApiError(403, "forbidden", "no access to lists"))
  private val notFound: (StatusCode, ApiError)  = (StatusCode.NotFound, ApiError(404, "not_found", "No such list item."))

  private def read[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.canRead("list")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])
  private def write[A](p: Principal, q: ConnectionIO[A]): ConnectionIO[Out[A]] =
    Authz.authorizer(p.role).flatMap(a => if (a.can(Level.Write, "list")) q.map(Right(_): Out[A]) else (Left(forbidden): Out[A]).pure[ConnectionIO])

  def lists(xa: Transactor[IO], p: Principal): IO[Out[List[ListView]]] = read(p, ListRepo.lists.map(_.map(lv))).transact(xa)
  def createList(xa: Transactor[IO], p: Principal, r: CreateListReq): IO[Out[ListView]] =
    write(p, ListRepo.createList(r.propertyId, r.name, r.vendor).map(id => ListView(id, r.name, r.vendor, r.propertyId))).transact(xa)
  def items(xa: Transactor[IO], p: Principal, listId: UUID): IO[Out[List[ItemView]]] = read(p, ListRepo.items(listId).map(_.map(iv))).transact(xa)

  /** Add an item; a Staff-proposed non-recurring item lands as needs_approval. */
  def addItem(xa: Transactor[IO], p: Principal, listId: UUID, r: AddItemReq): IO[Out[ItemView]] =
    write(p, ListRepo.addItem(listId, r.name, r.qty.getOrElse(1), r.recurring.getOrElse(false), r.url, p.role == "staff").map(iv)).transact(xa)

  /** Approve/decline — Manager/Principal only (Staff can't approve their own proposals). */
  private def decide(xa: Transactor[IO], p: Principal, itemId: UUID, op: UUID => ConnectionIO[Int]): IO[Out[Unit]] = {
    val tx = for {
      authz  <- Authz.authorizer(p.role)
      exists <- ListRepo.itemExists(itemId)
      res <-
        if (!authz.can(Level.Write, "list") || p.role == "staff") (Left(forbidden): Out[Unit]).pure[ConnectionIO]
        else if (!exists) (Left(notFound): Out[Unit]).pure[ConnectionIO]
        else op(itemId).as(Right(()): Out[Unit])
    } yield res
    tx.transact(xa)
  }
  def approve(xa: Transactor[IO], p: Principal, itemId: UUID): IO[Out[Unit]] = decide(xa, p, itemId, ListRepo.approve)
  def decline(xa: Transactor[IO], p: Principal, itemId: UUID): IO[Out[Unit]] = decide(xa, p, itemId, ListRepo.decline)

  private val err = statusCode.and(jsonBody[ApiError])
  private def bearer = auth.bearer[String]()

  val listsEndpoint     = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "lists").errorOut(err).out(jsonBody[List[ListView]]).summary("Shopping lists")
  val createListEndpoint = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "lists").in(jsonBody[CreateListReq]).errorOut(err).out(jsonBody[ListView]).summary("Create a list")
  val itemsEndpoint     = sttp.tapir.endpoint.get.securityIn(bearer).in("api" / "lists" / path[UUID]("id") / "items").errorOut(err).out(jsonBody[List[ItemView]]).summary("List items")
  val addItemEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "lists" / path[UUID]("id") / "items").in(jsonBody[AddItemReq]).errorOut(err).out(jsonBody[ItemView]).summary("Propose/add an item")
  val approveEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "list-items" / path[UUID]("id") / "approve").errorOut(err).out(jsonBody[Unit]).summary("Approve an item (Manager+)")
  val declineEndpoint   = sttp.tapir.endpoint.post.securityIn(bearer).in("api" / "list-items" / path[UUID]("id") / "decline").errorOut(err).out(jsonBody[Unit]).summary("Decline an item (Manager+)")

  def serverEndpoints(a: Auth, xa: Transactor[IO]): List[ServerEndpoint[Any, IO]] = List(
    listsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (_: Unit) => lists(xa, p)),
    createListEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (r: CreateListReq) => createList(xa, p, r)),
    itemsEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => items(xa, p, id)),
    addItemEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => { case (id, r) => addItem(xa, p, id, r) }),
    approveEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => approve(xa, p, id)),
    declineEndpoint.serverSecurityLogic(a.securityLogic).serverLogic(p => (id: UUID) => decline(xa, p, id)),
  )

  val endpoints: List[AnyEndpoint] = List(listsEndpoint, createListEndpoint, itemsEndpoint, addItemEndpoint, approveEndpoint, declineEndpoint)
}
