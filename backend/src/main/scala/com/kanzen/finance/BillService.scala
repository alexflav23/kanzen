package com.kanzen.finance

/** F15 — variance detection for the agent's bill reconciliation (default ±15%, SPEC §9.5). */
object BillService {
  val defaultThreshold: Double = 0.15

  def variancePct(prevMinor: Long, currentMinor: Long): Double =
    if (prevMinor == 0L) 0.0 else (currentMinor - prevMinor).toDouble / prevMinor.toDouble

  def isVariance(prevMinor: Long, currentMinor: Long, threshold: Double = defaultThreshold): Boolean =
    math.abs(variancePct(prevMinor, currentMinor)) >= threshold
}
