package com.kanzen.vendor

import java.time.LocalDate

/** F09 — a vendor is assignable only if its insurance is current (not expired). */
object VendorService {
  def insured(insuranceUntil: Option[LocalDate], asOf: LocalDate): Boolean =
    insuranceUntil.exists(d => !d.isBefore(asOf))
}
