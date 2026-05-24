package com.kanzen.product

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F35 — when is a product due reorder? */
object ProductService {
  def needsReorder(stockStatus: String): Boolean = stockStatus == "out" || stockStatus == "low"
}

final case class Product(id: UUID, name: String, stockStatus: String, preferredSpec: Option[String])

/** F35 — consumables/products with stock status + preferred vendors (buy links). */
object ProductRepo {
  def create(name: String, preferredSpec: Option[String]): ConnectionIO[Product] =
    sql"""insert into products (name, preferred_spec) values ($name, $preferredSpec)
          returning id, name, stock_status, preferred_spec""".query[Product].unique

  def insertOwned(
      ownerId: UUID,
      name: String,
      preferredSpec: Option[String],
      unit: Option[String]
  ): ConnectionIO[Product] =
    sql"""insert into products (owner_id, name, preferred_spec, unit) values ($ownerId, $name, $preferredSpec, $unit)
          returning id, name, stock_status, preferred_spec""".query[Product].unique

  def list: ConnectionIO[List[Product]] =
    sql"select id, name, stock_status, preferred_spec from products where deleted_at is null order by name"
      .query[Product]
      .to[List]

  def exists(id: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from products where id = $id and deleted_at is null)".query[Boolean].unique

  def addVendor(
      productId: UUID,
      vendorName: Option[String],
      buyUrl: Option[String],
      preferred: Boolean
  ): ConnectionIO[Int] =
    sql"insert into product_vendors (product_id, vendor_name, buy_url, preferred) values ($productId, $vendorName, $buyUrl, $preferred)".update.run

  def setStock(id: UUID, status: String): ConnectionIO[Int] =
    sql"update products set stock_status = $status where id = $id".update.run

  /** owner + property of a product (for the F34 event envelope). */
  def ownerAndProperty(id: UUID): ConnectionIO[Option[(UUID, Option[UUID])]] =
    sql"select owner_id, property_id from products where id = $id".query[(UUID, Option[UUID])].option

  def needingReorder: ConnectionIO[List[Product]] =
    sql"select id, name, stock_status, preferred_spec from products where stock_status in ('out','low') and deleted_at is null"
      .query[Product]
      .to[List]
}
