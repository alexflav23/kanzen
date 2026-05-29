package com.kanzen.nl

/** F32 — natural-language query: translate a prompt to a structured, READ-ONLY intent (Claude does this in production;
  * here is the validation + a deterministic stub). Never mutates; the generated query is schema-validated and
  * permission-filtered downstream. Intents cover the registry, finance (spend) and household ops (due-soon).
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
  final case class WhereIsIntent(keyword: String) extends Intent
  final case class CategoryValueIntent(category: String) extends Intent
  final case class ValueByCategoryIntent() extends Intent
  final case class SpendIntent(category: Option[String], months: Int) extends Intent
  final case class DueSoonIntent(days: Int) extends Intent
  final case class Unknown(prompt: String) extends Intent

  private val assetCats = List("guitar", "watch", "shoe", "painting", "art", "vehicle", "car", "wine")
  private val spendCats =
    List("maintenance", "cleaning", "household", "utilities", "insurance", "groceries", "travel", "staff")

  private def firstIn(p: String, words: List[String]): Option[String] = words.find(p.contains)

  /** Rough window in months from phrasing ("this month" = 1, "quarter" = 3, "this year"/default = 12). */
  private def months(p: String): Int =
    if (p.contains("this month") || p.contains("last month")) 1 else if (p.contains("quarter")) 3 else 12

  /** Rough horizon in days for "due" questions ("today" = 1, "week" = 7, default/"month" = 30). */
  private def days(p: String): Int =
    if (p.contains("today")) 1 else if (p.contains("week")) 7 else 30

  def translate(prompt: String): Intent = {
    val p = prompt.toLowerCase
    if (p.contains("how many")) CountIntent("asset", firstIn(p, assetCats))
    else if (p.contains("when did i last buy") || p.contains("last buy") || p.contains("last purchase"))
      LastPurchaseIntent(firstIn(p, assetCats).getOrElse("asset"))
    else if (p.contains("where is") || p.contains("where are") || p.contains("where's"))
      WhereIsIntent(firstIn(p, assetCats).orElse(keywordAfterWhere(p)).getOrElse(""))
    else if (p.contains("worth") || p.contains("value"))
      // a named category → that category's value ("how much are my watches worth"); otherwise the whole-registry breakdown
      firstIn(p, assetCats) match {
        case Some(cat) => CategoryValueIntent(cat)
        case None => ValueByCategoryIntent()
      }
    else if (p.contains("spend") || p.contains("spent") || p.contains("how much"))
      SpendIntent(firstIn(p, spendCats), months(p))
    else if (p.contains("due") || p.contains("coming up") || p.contains("upcoming"))
      DueSoonIntent(days(p))
    else Unknown(prompt)
  }

  // best-effort: the noun after "where is/are/'s" (drops a leading article) — e.g. "where is my royal oak" → "royal oak".
  private def keywordAfterWhere(p: String): Option[String] =
    List("where is", "where are", "where's")
      .collectFirst { case m if p.contains(m) => p.substring(p.indexOf(m) + m.length) }
      .map(_.trim.stripPrefix("my ").stripPrefix("the ").stripSuffix("?").trim)
      .filter(_.nonEmpty)
}
