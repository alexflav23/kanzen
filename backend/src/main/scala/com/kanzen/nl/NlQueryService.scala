package com.kanzen.nl

/** F32 — natural-language query: translate a prompt to a structured, READ-ONLY intent
  * (Claude does this in production; here is the validation + a deterministic stub).
  * Never mutates; the generated query is schema-validated and permission-filtered downstream.
  */
object NlQueryService {
  private val mutationKeywords = Set("insert", "update", "delete", "drop", "alter", "truncate", "create")

  def isReadOnly(sql: String): Boolean = {
    val lower = sql.toLowerCase
    mutationKeywords.forall(k => !lower.contains(k))
  }

  sealed trait Intent extends Product with Serializable
  final case class CountIntent(entity: String, filter: Option[String]) extends Intent
  final case class LastPurchaseIntent(category: String) extends Intent
  final case class Unknown(prompt: String) extends Intent

  def translate(prompt: String): Intent = {
    val p = prompt.toLowerCase
    def cat: Option[String] =
      List("guitar", "watch", "shoe", "painting").find(p.contains)
    if (p.contains("how many")) CountIntent("asset", cat)
    else if (p.contains("when did i last buy") || p.contains("last buy")) LastPurchaseIntent(cat.getOrElse("asset"))
    else Unknown(prompt)
  }
}
