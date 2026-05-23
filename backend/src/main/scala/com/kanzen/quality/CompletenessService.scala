package com.kanzen.quality

/** F23 — per-asset completeness score (0–100) + the missing checks (data-quality nudges). */
object CompletenessService {
  final case class Checks(hasPhoto: Boolean, hasCategory: Boolean, hasLocation: Boolean, hasProof: Boolean)

  private def flags(c: Checks): List[(String, Boolean)] =
    List("photo" -> c.hasPhoto, "category" -> c.hasCategory, "location" -> c.hasLocation, "proof" -> c.hasProof)

  def score(c: Checks): Int = {
    val f = flags(c)
    (f.count(_._2) * 100) / f.size
  }

  def missing(c: Checks): List[String] = flags(c).collect { case (k, false) => k }
}
