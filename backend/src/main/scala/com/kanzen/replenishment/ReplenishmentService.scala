package com.kanzen.replenishment

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** F36 — consumption-rate analytics: learn a product's purchase cadence and predict run-out. */
object ReplenishmentService {
  def avgIntervalDays(sortedDates: List[LocalDate]): Option[Double] =
    if (sortedDates.size < 2) None
    else {
      val gaps = sortedDates.sliding(2).collect { case List(a, b) => ChronoUnit.DAYS.between(a, b).toDouble }.toList
      Some(gaps.sum / gaps.size)
    }

  def predictedNext(last: LocalDate, avgDays: Double): LocalDate = last.plusDays(math.round(avgDays))

  def dueSoon(predicted: LocalDate, asOf: LocalDate, leadDays: Int): Boolean =
    !predicted.isAfter(asOf.plusDays(leadDays.toLong))
}
