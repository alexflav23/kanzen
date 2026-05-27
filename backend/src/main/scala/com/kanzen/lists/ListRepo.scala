package com.kanzen.lists

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.time.LocalDate
import java.util.UUID

final case class ListItem(
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
final case class ShoppingList(
    id: UUID,
    name: String,
    vendor: Option[String],
    propertyId: Option[UUID],
    `type`: String,
    cycle: Option[String],
    nextOrder: Option[LocalDate],
    status: String
)

/** F08 — shopping lists + items with the propose/approve/roll-forward workflow. */
object ListRepo {
  def createList(propertyId: Option[UUID], name: String, vendor: Option[String]): ConnectionIO[UUID] =
    sql"insert into shopping_lists (property_id, name, vendor) values ($propertyId, $name, $vendor) returning id"
      .query[UUID]
      .unique

  /** Reconfigure a list — its property, vendor, ordering cadence + next-order day, type, name. */
  def update(
      listId: UUID,
      name: String,
      propertyId: Option[UUID],
      vendor: Option[String],
      cycle: Option[String],
      nextOrder: Option[LocalDate],
      typ: String
  ): ConnectionIO[Int] =
    sql"""update shopping_lists set name = $name, property_id = $propertyId, vendor = $vendor,
            cycle = $cycle, next_order = $nextOrder, type = $typ
          where id = $listId and deleted_at is null""".update.run

  def lists: ConnectionIO[List[ShoppingList]] =
    sql"""select id, name, vendor, property_id, type, cycle, next_order, status
          from shopping_lists where deleted_at is null order by name"""
      .query[ShoppingList]
      .to[List]

  def listExists(listId: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from shopping_lists where id = $listId and deleted_at is null)".query[Boolean].unique

  def itemExists(itemId: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from list_items where id = $itemId)".query[Boolean].unique

  def decline(itemId: UUID): ConnectionIO[Int] =
    sql"update list_items set status = 'declined' where id = $itemId".update.run

  def addItem(
      listId: UUID,
      name: String,
      qty: Int,
      recurring: Boolean,
      url: Option[String],
      category: Option[String],
      note: Option[String],
      estPriceMinor: Option[Long],
      addedBy: Option[UUID],
      proposedByStaff: Boolean,
      substituteFor: Option[UUID] = None
  ): ConnectionIO[ListItem] = {
    // a substitute is an alternative for an already-listed item — it doesn't route to approval
    val status = if (substituteFor.isDefined) "added" else ListService.initialStatus(recurring, proposedByStaff)
    sql"""insert into list_items (list_id, name, qty, recurring, url, category, note, est_price_minor, added_by, status, substitute_for)
          values ($listId, $name, $qty, $recurring, $url, $category, $note, $estPriceMinor, $addedBy, $status, $substituteFor)
          returning id, name, qty, status, recurring, url, category, note, est_price_minor, currency, null, substitute_for"""
      .query[ListItem]
      .unique
  }

  def approve(itemId: UUID): ConnectionIO[Int] =
    sql"update list_items set status = 'added' where id = $itemId".update.run

  def items(listId: UUID): ConnectionIO[List[ListItem]] =
    sql"""select i.id, i.name, i.qty, i.status, i.recurring, i.url, i.category, i.note, i.est_price_minor, i.currency,
            u.display_name, i.substitute_for
          from list_items i left join users u on u.id = i.added_by
          where i.list_id = $listId order by i.category nulls last, i.created_at"""
      .query[ListItem]
      .to[List]

  /** Place the order: roll the cycle forward (weekly/fortnightly/monthly) from today. The list "closes on order day and
    * rolls forward" (F08) — recurring items persist for the next cycle.
    */
  def placeOrder(listId: UUID): ConnectionIO[Int] =
    sql"""update shopping_lists set next_order = current_date + (
            case cycle when 'weekly' then interval '7 days'
                       when 'fortnightly' then interval '14 days'
                       when 'monthly' then interval '1 month'
                       else interval '7 days' end)
          where id = $listId and deleted_at is null""".update.run
}
