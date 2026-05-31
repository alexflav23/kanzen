package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Receipt(id: UUID, totalMinor: Option[Long], currency: Option[String], status: String)
final case class LineItem(id: UUID, description: Option[String], confirmedCategory: Option[String], status: String)

/** F13 — receipts + line items (the parse pipeline confirms suggested categories). */
object ReceiptRepo {
  def create(
      merchant: Option[String],
      totalMinor: Option[Long],
      currency: Option[String],
      tenantId: UUID = com.kanzen.tenant.Tenant.DefaultId
  ): ConnectionIO[Receipt] =
    sql"""insert into receipts (tenant_id, merchant, total_minor, currency) values ($tenantId, $merchant, $totalMinor, $currency)
          returning id, total_minor, currency, status""".query[Receipt].unique

  def addLineItem(
      receiptId: UUID,
      lineNo: Int,
      description: Option[String],
      totalMinor: Option[Long],
      suggestedCategory: Option[String]
  ): ConnectionIO[LineItem] =
    sql"""insert into receipt_line_items (receipt_id, line_no, description, total_minor, suggested_category)
          values ($receiptId, $lineNo, $description, $totalMinor, $suggestedCategory)
          returning id, description, confirmed_category, status""".query[LineItem].unique

  def confirm(itemId: UUID, category: String): ConnectionIO[Int] =
    sql"update receipt_line_items set confirmed_category = $category, status = 'confirmed' where id = $itemId".update.run

  def lineItems(receiptId: UUID): ConnectionIO[List[LineItem]] =
    sql"select id, description, confirmed_category, status from receipt_line_items where receipt_id = $receiptId order by line_no"
      .query[LineItem]
      .to[List]
}
