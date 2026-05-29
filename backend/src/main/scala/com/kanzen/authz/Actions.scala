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
      Action("asset", "custody", Write),
      Action("asset", "set_hero", Write),
      Action("asset", "restructure", Write),
      Action("asset", "value", Admin, sensitive = true) // record a valuation (Principal-grade)
    ) ++
      // `asset_event` is its own gated resource (the maintenance carve-out: log an event without seeing valuations).
      List(Action("asset_event", "view", Read), Action("asset_event", "create", Write)) ++
      List(
        Action("market_value", "view", Admin, sensitive = true),
        Action("insured_value", "view", Admin, sensitive = true)
      ) ++
      // collections + asset groups are authorized as part of the `asset` resource (no separate seed rules), so they
      // are not independent catalogue entries — a future slice can split them out with a matching seed mapping.
      crud("tag") ++ crud("taxonomy") ++ crud("custom_field") ++
      crud("brand") ++ List(Action("brand", "add", Write)) ++
      // ── Documents (F05) ──
      crud("document") ++ List(Action("document", "upload", Write), Action("document", "download", Read)) ++
      // ── Property (F03) ── (locations are authorized as part of the `property` resource)
      crud("property") ++ crud("defect") ++
      // ── Operations ──
      crud("list") ++ List(
        Action("list", "propose", Write),
        Action("list", "approve", Write),
        Action("list", "order", Write)
      ) ++
      crud("task") ++ crud("calendar") ++ crud("maintenance") ++ crud("product") ++
      crud("vendor") ++ crud("person") ++
      // ── Collaborative Inbox (W9) ── thread assign/status/comment ride the inbox resource
      List(
        Action("inbox", "view", Read),
        Action("thread", "assign", Write),
        Action("thread", "status", Write),
        Action("thread", "comment", Write)
      ) ++
      // ── Finance ── (the pay queue + payment methods are authorized as part of `bill`; bank sync/reconcile as part
      // of `bank_account` — matching the real gating resources, so grants bite without a separate seed mapping)
      crud("bill") ++ List(
        Action("bill", "approve", Write),
        Action("bill", "pay", Write),
        Action("bill", "schedule", Write)
      ) ++
      crud("expense") ++ List(Action("expense", "approve", Write), Action("expense", "export", Read)) ++
      crud("bank_account") ++ List(Action("bank_account", "sync", Write), Action("bank_account", "reconcile", Write)) ++
      crud("receipt") ++ List(Action("receipt", "parse", Write)) ++
      List(Action("ledger", "view", Read), Action("fx", "view", Read)) ++
      // ── Wealth ── (Principal-grade: even viewing is admin-level + sensitive. Investments authorize as part of
      // `wealth`; tax view as part of `ledger`.)
      List(
        Action("wealth", "view", Admin, sensitive = true),
        Action("wealth", "create", Admin, sensitive = true),
        Action("wealth", "edit", Admin, sensitive = true),
        Action("wealth", "delete", Admin, sensitive = true)
      ) ++
      // ── System ── (registry-health + insights views are authorized as part of the `asset` resource; the
      // data-quality flag stream + scan/resolve is its own resource)
      List(Action("search", "view", Read)) ++
      List(
        Action("data_quality", "view", Read),
        Action("data_quality", "scan", Write),
        Action("data_quality", "edit", Write)
      ) ++
      List(Action("notification", "view", Read), Action("notification", "manage", Write)) ++
      // backups are admin-only, including listing them.
      List(Action("backup", "view", Admin), Action("backup", "run", Admin), Action("backup", "restore", Admin)) ++
      List(Action("agent", "view", Read), Action("agent", "use", Write)) ++
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
