package com.kanzen.receipt

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

final case class Receipt(id: UUID, kind: String, merchant: Option[String], totalMinor: Option[Long], currency: Option[String], status: String)
final case class LineItem(
    id: UUID,
    receiptId: UUID,
    lineNo: Option[Int],
    description: Option[String],
    totalMinor: Option[Long],
    currency: Option[String],
    brandNorm: Option[String],
    suggestedCategory: Option[String],
    confirmedCategory: Option[String],
    status: String,
)

/** F13 — receipts + line items. OCR/Bedrock parse is an adapter (deferred); this stores
  * the parsed result. Brand normalisation on each line powers product-level spend (F32). */
object ReceiptService {
  /** A stable brand/product key from a free-text line: the text before the first digit,
    * lowercased and hyphenated. "Coca-Cola 330ml" → "coca-cola". */
  def brandNorm(description: String): String =
    description.takeWhile(c => !c.isDigit).toLowerCase.replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "")
}

object ReceiptRepo {
  private val rCols = fr"id, kind, merchant, total_minor, currency, status"
  private val liCols = fr"id, receipt_id, line_no, description, total_minor, currency, brand_norm, suggested_category, confirmed_category, status"

  def create(ownerId: UUID, kind: String, merchant: Option[String], totalMinor: Option[Long], currency: Option[String]): ConnectionIO[Receipt] =
    (fr"""insert into receipts (owner_id, kind, merchant, total_minor, currency)
          values ($ownerId, $kind, $merchant, $totalMinor, $currency) returning""" ++ rCols).query[Receipt].unique

  def addLine(receiptId: UUID, lineNo: Option[Int], description: Option[String], totalMinor: Option[Long],
              currency: Option[String], brandNorm: Option[String], suggestedCategory: Option[String]): ConnectionIO[LineItem] =
    (fr"""insert into receipt_line_items (receipt_id, line_no, description, total_minor, currency, brand_norm, suggested_category)
          values ($receiptId, $lineNo, $description, $totalMinor, $currency, $brandNorm, $suggestedCategory)
          returning""" ++ liCols).query[LineItem].unique

  def get(id: UUID): ConnectionIO[Option[Receipt]] =
    (fr"select" ++ rCols ++ fr"from receipts where id = $id").query[Receipt].option

  def list: ConnectionIO[List[Receipt]] =
    (fr"select" ++ rCols ++ fr"from receipts order by created_at desc").query[Receipt].to[List]

  def lines(receiptId: UUID): ConnectionIO[List[LineItem]] =
    (fr"select" ++ liCols ++ fr"from receipt_line_items where receipt_id = $receiptId order by line_no").query[LineItem].to[List]

  def lineExists(lineId: UUID, receiptId: UUID): ConnectionIO[Boolean] =
    sql"select exists(select 1 from receipt_line_items where id = $lineId and receipt_id = $receiptId)".query[Boolean].unique

  def confirmLine(lineId: UUID, category: String): ConnectionIO[Int] =
    sql"update receipt_line_items set confirmed_category = $category, status = 'confirmed' where id = $lineId".update.run

  /** Total spend across confirmed/parsed line items for a brand (F32 product-level spend). */
  def spendByBrand(brandNorm: String): ConnectionIO[Long] =
    sql"select coalesce(sum(total_minor), 0) from receipt_line_items where brand_norm = $brandNorm".query[Long].unique
}
