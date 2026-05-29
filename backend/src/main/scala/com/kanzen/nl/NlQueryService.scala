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
  // NL-2b — crisp, single-fact intents about a *named* thing (the subject after "my"/"the").
  final case class ServiceDueIntent(keyword: String) extends Intent // "when is my car next due a service"
  final case class InsuranceAmountIntent(keyword: String) extends Intent // "how much is my car insurance"
  final case class LastActivityIntent(keyword: String) extends Intent // "when was the housekeeper last in"
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
    // NL-2b crisp intents, placed *before* the generic spend/due branches they would otherwise be swallowed by:
    // "…next due a **service**" → service, not due-soon; "how much is my car **insurance**" → cover, not spend.
    else if (p.contains("service") && !p.contains("spend") && !p.contains("spent"))
      ServiceDueIntent(subject(p))
    else if (
      (p.contains("insurance") || p.contains("insured") || p.contains("policy")) &&
      !p.contains("spend") && !p.contains("spent")
    )
      InsuranceAmountIntent(subject(p))
    else if (isLastActivity(p)) LastActivityIntent(subject(p))
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

  // "when was X last in/here", "X's last visit" — a person/role being on-site. Kept distinct from "last buy/purchase".
  private def isLastActivity(p: String): Boolean =
    p.contains("last in") || p.contains("last here") || p.contains("last visit") || p.contains("last on site") ||
      (p.contains("last") && (p.contains("come") || p.contains("came"))) ||
      ((p.contains("when was") || p.contains("when did")) && p.contains("last") &&
        !p.contains("buy") && !p.contains("purchase"))

  private val nounStop = Set(
    "next",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "due",
    "a",
    "an",
    "the",
    "my",
    "for",
    "do",
    "i",
    "have",
    "service",
    "serviced",
    "servicing",
    "insurance",
    "insured",
    "policy",
    "worth",
    "value",
    "valued",
    "cost",
    "costs",
    "costing",
    "last",
    "in",
    "here",
    "visit",
    "come",
    "came",
    "on",
    "site",
    "at",
    "when",
    "did",
    "does",
    "much",
    "how",
    "and",
    "of"
  )

  /** The thing the question is *about* — the noun-phrase after the last "my "/"the " marker, taken up to a stopword.
    * "when is my car next due a service" → "car"; "…for my mercedes" → "mercedes"; "the housekeeper last in" →
    * "housekeeper". Best-effort and deterministic (Claude does this far better in prod; this is the sandbox stub).
    */
  def subject(prompt: String): String = {
    val p = prompt.toLowerCase
    val starts = List("my ", "the ").flatMap(m => indicesOf(p, m).map(_ + m.length))
    starts.sorted.lastOption
      .map(s =>
        p.substring(s).split("[^a-z0-9]+").filter(_.nonEmpty).takeWhile(w => !nounStop.contains(w)).mkString(" ")
      )
      .getOrElse("")
      .trim
  }

  /** A loose stem so a role-noun matches an activity title — "housekeeper" → "housekeep" (matches "Housekeeping"),
    * "gardener" → "garden", "trainer" → "train". Strips one common agent/gerund suffix from the last word.
    */
  def stem(keyword: String): String = {
    val w = keyword.trim.toLowerCase.split("\\s+").lastOption.getOrElse("")
    List("ing", "ers", "er", "ist", "or")
      .find(s => w.endsWith(s) && w.length - s.length >= 4)
      .map(s => w.dropRight(s.length))
      .getOrElse(w)
  }

  private def indicesOf(s: String, sub: String): List[Int] = {
    @annotation.tailrec
    def go(from: Int, acc: List[Int]): List[Int] = s.indexOf(sub, from) match {
      case -1 => acc.reverse
      case i => go(i + sub.length, i :: acc)
    }
    go(0, Nil)
  }

  // best-effort: the noun after "where is/are/'s" (drops a leading article) — e.g. "where is my royal oak" → "royal oak".
  private def keywordAfterWhere(p: String): Option[String] =
    List("where is", "where are", "where's")
      .collectFirst { case m if p.contains(m) => p.substring(p.indexOf(m) + m.length) }
      .map(_.trim.stripPrefix("my ").stripPrefix("the ").stripSuffix("?").trim)
      .filter(_.nonEmpty)
}
