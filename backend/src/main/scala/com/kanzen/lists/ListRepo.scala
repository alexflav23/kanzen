package com.kanzen.lists

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class ListItem(id: UUID, name: String, qty: Int, status: String, recurring: Boolean, url: Option[String])
final case class ShoppingList(id: UUID, name: String, vendor: Option[String], propertyId: Option[UUID])

/** F08 — shopping lists + items with the propose/approve workflow. */
object ListRepo {
  def createList(propertyId: Option[UUID], name: String, vendor: Option[String]): ConnectionIO[UUID] =
    sql"insert into shopping_lists (property_id, name, vendor) values ($propertyId, $name, $vendor) returning id"
      .query[UUID]
      .unique

  def lists: ConnectionIO[List[ShoppingList]] =
    sql"select id, name, vendor, property_id from shopping_lists where deleted_at is null order by name"
      .query[ShoppingList]
      .to[List]

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
      proposedByStaff: Boolean
  ): ConnectionIO[ListItem] = {
    val status = ListService.initialStatus(recurring, proposedByStaff)
    sql"""insert into list_items (list_id, name, qty, recurring, url, status)
          values ($listId, $name, $qty, $recurring, $url, $status)
          returning id, name, qty, status, recurring, url""".query[ListItem].unique
  }

  def approve(itemId: UUID): ConnectionIO[Int] =
    sql"update list_items set status = 'added' where id = $itemId".update.run

  def items(listId: UUID): ConnectionIO[List[ListItem]] =
    sql"select id, name, qty, status, recurring, url from list_items where list_id = $listId order by created_at"
      .query[ListItem]
      .to[List]
}
