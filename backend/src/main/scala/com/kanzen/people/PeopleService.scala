package com.kanzen.people

import java.time.LocalDate

/** F10 — expiry-reminder window: a permit/review due within the next N days (not already past). */
object PeopleService {
  def expiresWithin(expiry: Option[LocalDate], asOf: LocalDate, days: Int): Boolean =
    expiry.exists(d => !d.isBefore(asOf) && !d.isAfter(asOf.plusDays(days.toLong)))
}
