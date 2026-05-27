package com.kanzen.authz

import com.kanzen.authz.Level._

/** A single gated action — object × verb (HubSpot-style granularity). `minLevel` is the legacy `permission_rules` level
  * the action maps to, so today's roles authorize it unchanged (the bridge); F02 v2 layers explicit per-action grants
  * on top. `sensitive` flags valuation-grade actions.
  */
final case class Action(resource: String, verb: String, minLevel: Level, sensitive: Boolean = false) {
  def key: String = s"$resource:$verb"
}

/** F02 v2 — the canonical catalogue of every gated action. The single source of truth the builder UI renders and
  * `can(action)` resolves against. Grows as endpoints migrate to `can(action)` (S3); every `can(action)` call must
  * reference an entry here. See `specs/F02v2-enterprise-rbac.md`.
  */
object Actions {
  private def crud(resource: String): List[Action] =
    List(
      Action(resource, "view", Read),
      Action(resource, "create", Write),
      Action(resource, "edit", Write),
      Action(resource, "delete", Write)
    )

  val all: List[Action] =
    // ── Registry (F04) ──
    crud("asset") ++ List(
      Action("asset", "move", Write),
      Action("asset", "set_hero", Write),
      Action("asset", "log_event", Write),
      Action("asset", "restructure", Write),
      Action("asset", "value", Admin, sensitive = true) // record a valuation (Principal-grade)
    ) ++
      List(
        Action("market_value", "view", Admin, sensitive = true),
        Action("insured_value", "view", Admin, sensitive = true)
      ) ++
      crud("collection") ++ crud("asset_group") ++ crud("tag") ++ crud("taxonomy") ++ crud("custom_field") ++
      crud("brand") ++ List(Action("brand", "add", Write)) ++
      // ── Documents (F05) ──
      crud("document") ++ List(Action("document", "upload", Write), Action("document", "download", Read)) ++
      // ── Property (F03) ──
      crud("property") ++ crud("location") ++ crud("defect") ++
      // ── Operations ──
      crud("list") ++ List(
        Action("list", "propose", Write),
        Action("list", "approve", Write),
        Action("list", "order", Write)
      ) ++
      crud("task") ++ crud("calendar") ++ crud("maintenance") ++ crud("product") ++
      crud("vendor") ++ crud("person") ++
      // ── Finance ──
      crud("bill") ++ List(Action("bill", "approve", Write), Action("bill", "pay", Write)) ++
      crud("expense") ++ List(Action("expense", "approve", Write), Action("expense", "export", Read)) ++
      crud("payment_method") ++ List(Action("payment", "schedule", Write)) ++
      crud("bank_account") ++ List(Action("bank", "sync", Write), Action("bank", "reconcile", Write)) ++
      crud("receipt") ++ List(Action("receipt", "parse", Write)) ++
      List(Action("ledger", "view", Read), Action("fx", "view", Read), Action("tax", "view", Read)) ++
      // ── Wealth ──
      crud("wealth") ++ crud("investment") ++
      // ── System ──
      List(Action("search", "view", Read), Action("data_quality", "view", Read), Action("insights", "view", Read)) ++
      List(Action("notification", "view", Read), Action("notification", "manage", Write)) ++
      List(Action("backup", "view", Read), Action("backup", "run", Admin), Action("backup", "restore", Admin)) ++
      List(Action("agent", "use", Write)) ++
      // ── Admin (authz itself) ──
      List(
        Action("role", "view", Admin),
        Action("role", "manage", Admin),
        Action("team", "view", Admin),
        Action("team", "manage", Admin),
        Action("user", "impersonate", Admin)
      )

  /** Lookup by `resource:verb`. */
  val byKey: Map[String, Action] = all.map(a => a.key -> a).toMap

  def get(key: String): Option[Action] = byKey.get(key)

  /** Distinct resources in the catalogue (for the builder UI's object list). */
  val resources: List[String] = all.map(_.resource).distinct
}
