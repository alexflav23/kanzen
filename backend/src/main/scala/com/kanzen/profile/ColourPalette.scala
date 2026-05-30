package com.kanzen.profile

/** F47 — the canonical 12-colour identity palette. Each value is the palette key the API + UI both understand. Custom
  * hexes (`#rrggbb` / `#rgb`) are also accepted, but must be validated for AA contrast on the frontend before save (the
  * backend just checks the format).
  */
object ColourPalette {
  // Ordered alphabetically so the hash → bucket mapping is stable and obvious.
  val keys: List[String] = List(
    "amber",
    "azure",
    "coral",
    "gold",
    "indigo",
    "lime",
    "magenta",
    "mint",
    "rose",
    "slate",
    "teal",
    "violet"
  )
  private val keySet = keys.toSet
  private val hexRe = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$".r

  /** True iff `s` is either a known palette key or a well-formed hex literal. */
  def isValid(s: String): Boolean = keySet(s.toLowerCase) || hexRe.matches(s)

  /** Deterministic bucket selection — mirrors the SQL backfill in V3_9_0. */
  def defaultFor(userId: java.util.UUID): String = {
    val h = userId.toString.hashCode
    keys((math.abs(h.toLong).toInt) % keys.size)
  }
}
