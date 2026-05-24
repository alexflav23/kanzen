package com.kanzen.finance

/** F38 — UK tax estimation (2024/25 England bands), in pence. Estimation only — Kanzen
  * never files or pays. Personal allowance tapers £1 per £2 of income over £100,000
  * (gone at £125,140); 20% basic / 40% higher / 45% additional. */
object TaxService {
  private val personalAllowance = 1_257_000L // £12,570
  private val basicBand         = 3_770_000L  // £37,700 of taxable income @ 20%
  private val additionalGross   = 12_514_000L // £125,140 — additional-rate threshold

  def estimateIncomeTaxMinor(grossMinor: Long): Long =
    if (grossMinor <= 0L) 0L
    else {
      val over100k = math.max(0L, grossMinor - 10_000_000L)
      val pa       = math.max(0L, personalAllowance - over100k / 2)
      val taxable  = math.max(0L, grossMinor - pa)
      val addlLimitTaxable = math.max(basicBand, additionalGross - pa)
      val band20 = math.min(taxable, basicBand)
      val band40 = math.max(0L, math.min(taxable, addlLimitTaxable) - basicBand)
      val band45 = math.max(0L, taxable - addlLimitTaxable)
      (band20 * 20 + band40 * 40 + band45 * 45) / 100
    }

  /** Effective rate as a whole-number percentage (0 when income ≤ 0). */
  def effectiveRatePct(grossMinor: Long): Int =
    if (grossMinor <= 0L) 0 else (estimateIncomeTaxMinor(grossMinor) * 100 / grossMinor).toInt
}
