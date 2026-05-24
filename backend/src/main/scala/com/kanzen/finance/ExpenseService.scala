package com.kanzen.finance

/** F17 — approval-threshold routing. Per-jurisdiction native thresholds (no FX, SPEC §9.5). Unknown currency → require
  * approval (safe default).
  */
object ExpenseService {
  // minor units: £1,500.00 = 150000 pence; S$2,500.00 = 250000 cents
  val thresholds: Map[String, Long] = Map("GBP" -> 150000L, "SGD" -> 250000L)

  def needsApproval(amountMinor: Long, currency: String): Boolean =
    thresholds.get(currency) match {
      case Some(t) => amountMinor >= t
      case None => true
    }

  def initialStatus(amountMinor: Long, currency: String): String =
    if (needsApproval(amountMinor, currency)) "pending_approval" else "approved"
}
