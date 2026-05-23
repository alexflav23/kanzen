package com.kanzen.finance

import doobie._
import doobie.implicits._
import doobie.postgres.implicits._

import java.util.UUID

/** F16 — only manually-paid bills are "markable"; auto bills settle externally (Kanzen never pays). */
object PayQueueService {
  def canMarkPaid(mode: String): Boolean = mode == "manual"
}

final case class PaymentMethod(id: UUID, displayName: String, last4: Option[String])
final case class BillPayment(id: UUID, mode: String, state: String)

object PaymentRepo {
  def createMethod(`type`: String, displayName: String, last4: Option[String], currency: Option[String], vaultRef: Option[String]): ConnectionIO[PaymentMethod] =
    sql"""insert into payment_methods (type, display_name, last4, currency, vault_ref)
          values (${`type`}, $displayName, $last4, $currency, $vaultRef)
          returning id, display_name, last4""".query[PaymentMethod].unique

  def schedule(billId: Option[UUID], methodId: Option[UUID], amountMinor: Long, currency: String, mode: String): ConnectionIO[BillPayment] =
    sql"""insert into bill_payments (bill_id, payment_method_id, amount_minor, currency, mode)
          values ($billId, $methodId, $amountMinor, $currency, $mode)
          returning id, mode, state""".query[BillPayment].unique

  /** Records reality for a MANUAL payment; auto payments cannot be marked paid (no money moved by us). */
  def markPaid(id: UUID): ConnectionIO[Int] =
    sql"update bill_payments set state = 'paid' where id = $id and mode = 'manual'".update.run

  def get(id: UUID): ConnectionIO[Option[BillPayment]] =
    sql"select id, mode, state from bill_payments where id = $id".query[BillPayment].option
}
