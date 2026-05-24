# Feature F29 — Dashboard, Insights & reporting

| | |
|---|---|
| **Feature ID** | F29 |
| **Milestone** | M7 |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | F18 (ledger/derived balances), F23 (completeness), F20 (valuation), F17 (spend), and every operational domain |
| **Spec references** | SPEC §7.1, §7.12; `input/views/dashboard.jsx`, `insights.jsx`, App. E.2/E.10 |

> **Decisions (revisitable):** **folds the Dashboard into this feature** (it was previously implicit). Two surfaces: a **role-aware Dashboard** (calm at-a-glance) and **Insights** (aggregate reporting). Both are **read/aggregation** layers over every domain, **permission- and scope-filtered** (Manager sees no valuations), **native-currency** (no silent FX). Built on the structured model so the F32 NL layer can sit on top.

## 1. Purpose & user value
The two "zoom levels" of the whole system: the Dashboard answers "what needs me today?" in a glance; Insights answers "where did the money go, what do we own, what's it worth, what's missing?". Together they make a sprawling system feel calm and legible.

## 2. Roles & permissions
**Role-aware**: Principal sees registry value/spend/ledger-derived totals; **Manager** sees operational widgets but **no valuations/ledger/balances** (F02 field-filtered — aggregates must not leak hidden data); **Staff** see their tasks/lists/property. Everything property-scoped.

## 3. Data model
Mostly **aggregation / materialised views** (refreshed incrementally):
- `mv_spend_by_category`, `mv_spend_by_property_month`, `mv_lifetime_cost_per_asset` (acquisition vs operating), `mv_inventory_value` (per currency), `mv_registry_health` (photographed/categorised/located/proof/insured/appraisal-recency), `mv_budget_spend`.
- `dashboard_widgets` (optional per-user layout/config). No new source-of-truth tables.

## 4. API
- `GET /api/dashboard` — role-aware widget bundle (today/overdue tasks, Triage + approvals counts, upcoming events, this-month spend vs budget, agent activity, properties, expiring-60d, lists, connected-systems health).
- `GET /api/insights/*` — `spend-by-category`, `top-assets`, `lifetime-cost`, `registry-health`, `inventory-value`, `budget` (all permission-filtered, per-currency).

## 5. UI / screens & states
- **Dashboard** (`dashboard.jsx`, App. E.2): greeting + status + Quick add; **hero attention strip** (Triage + approvals); two-column body — Upcoming (14d, agent-tagged), This-month-by-property (spend/budget + sparkline), Agent activity; right rail — Properties, Expiring-within-60-days, This-week's-lists, Connected systems. Role-aware (registry health for Principal). 
- **Insights** (`insights.jsx`, App. E.10): tiles (total inventory value, lifetime spend, assets tracked, completeness); **lifetime spend by category** (stacked); **top assets by value**; **lifetime cost: acquisition vs operating**; **registry-health** bars.
- States: loading (skeleton), empty (new household), role-trimmed (Manager without valuation tiles), per-currency splits.

## 6. Business rules & validation
- **Permission/scope filtering on aggregates** — a Manager's Insights omit valuation/ledger dimensions (no leak via totals); Staff dashboards show only their scope.
- **Native-currency** aggregation; cross-currency totals only where explicitly designed (per-currency tiles), no silent FX (§19 open).
- **Freshness**: materialised views refreshed on a schedule + key events; surface as "as of".
- **Lifetime cost** = acquisition + associated/service costs (F17/F19); **inventory value** from latest valuations (F20).

## 7. Integrations
Reads F06/F07/F08/F11 (dashboard ops), F17/F18 (spend/ledger), F20/F21 (value/insurance), F23 (completeness), F25 (agent activity), F12 (connected systems). Feeds F32 (NL query over the same model).

## 8. Edge cases
Manager aggregate must not reveal hidden valuations (test); mixed-currency household; new/empty household; scoped dashboards; materialised-view staleness; very large histories (incremental refresh); widget personalisation.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Principal's Dashboard shows full widget set**  ‹maps: `DashboardPrincipalIT`, web `dashboard.spec` principal›
- **Given** a seeded household with pending approvals, upcoming events, and connected institutions
- **When** Toby opens the Dashboard
- **Then** he sees: the hero attention strip (Triage count + approvals count + amounts), Upcoming 14-day list, This-month spend vs budget per property, Agent activity ribbon, Expiring-within-60-days, This-week's-lists, and Connected-systems health
- **And** Registry health (photographed/categorised/insured completeness) is visible — a Principal-only tile.

**AC2 — Manager's Dashboard omits valuations and ledger; Staff sees only their scope**  ‹maps: `DashboardRoleFilterIT`, web `dashboard.spec` manager, web `dashboard.spec` staff›  *(invariant: aggregates must not leak hidden data)*
- **Given** Lorna (Manager) and Marcia (Wardian Staff)
- **When** each opens their Dashboard
- **Then** Lorna sees operational widgets (approvals, pay queue, upcoming, spend) but **no valuation tiles, no ledger-derived balances, no balance figures** — field-stripped server-side
- **And** Marcia sees only her property's tasks and lists; she cannot see Lorna's operational finance widgets nor any Singapore data.

**AC3 — Insights renders all four Principal views**  ‹maps: `InsightsTilesIT`, web `insights.spec`›
- **Given** a household with assets, expenses, and associated costs
- **When** Toby opens Insights
- **Then** the page renders: (1) lifetime spend by category (stacked bar), (2) top assets by value, (3) acquisition vs operating lifetime cost split, and (4) registry-health percentage bars
- **And** all figures are sourced from the materialised views; a "as of" timestamp is shown.

**AC4 — Multi-currency totals show per-currency; no silent FX**  ‹maps: `InsightsCurrencyIT`, web `insights.spec` currency-tiles›  *(invariant: FX uses transaction-date rate — F37; no silent blending)*
- **Given** Wardian GBP and Singapore SGD costs in the household
- **When** Toby views the inventory value or spend totals in Insights
- **Then** totals are displayed as **separate per-currency figures** (GBP and SGD) by default; no silent FX blending occurs
- **And** any cross-currency rollup is clearly **labelled as a dated estimate** (per F37) with the per-currency breakdown expandable.

**AC5 — Manager Insights aggregate does not leak valuations via totals**  ‹maps: `InsightsLeakIT`›  *(invariant: server-side scope; no leak via totals)*
- **Given** assets with non-zero valuations in the system
- **When** Lorna requests `GET /api/insights/inventory-value` or `GET /api/insights/top-assets`
- **Then** the response **omits** valuation figures entirely (not zero-filled — absent); no total or subtotal can be reverse-engineered to infer a hidden valuation
- **And** the backend test asserts that each Insights endpoint's Manager-scoped response contains no valuation, balance, or ledger field.

**AC6 — Staff dashboard shows only their property's scope**  ‹maps: `DashboardStaffScopeIT`›  *(invariant: property-scope enforced)*
- **Given** Siti (Singapore Staff)
- **When** she opens the Dashboard
- **Then** she sees only Singapore-scoped tasks and lists; no Wardian data appears in any widget
- **And** requests for Wardian-scoped data return **403/404** — existence not leaked.

## 10. Test plan
Backend (weaver+PG): aggregate correctness; **permission/scope-filtered aggregates (leak tests)**; per-currency; materialised-view refresh. Web: Vitest dashboard widgets + insights charts (role-trimmed); Playwright Principal vs Manager vs Staff dashboards.

## 11. Observability & audit
Metrics: dashboard/insights latency, MV refresh lag, widget usage. (Reads only; no audit writes beyond access logging.)

## 12. Open questions
1. Cross-currency net-worth view (§19 open — if/where/what rate). 2. Dashboard widget personalisation depth. 3. Materialised-view vs on-the-fly for large histories.
