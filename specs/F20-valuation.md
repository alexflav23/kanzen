# Feature F20 — Valuation snapshots

| | |
|---|---|
| **Feature ID** | F20 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets), F19 (events), F05 (docs); feeds F29 (Insights), F23 (appraisal recency) |
| **Spec references** | SPEC §8.6; `input/views/asset-detail.jsx → ValuationTab`, App. E.6 |

> **Decisions (revisitable):** dated **valuation snapshots** of several kinds (acquisition / replacement / market / insured / appraisal / realised-sale) with source, confidence, supporting docs and rationale; valuation/insured fields are **Principal-private** (Manager field-denied, F02); history queryable per asset/collection/category/group.

## 1. Purpose & user value
What everything is worth, tracked over time and by whom — market estimates, insured values, professional appraisals — so the Principal sees change-since-acquisition, total inventory value, and what needs re-appraising.

## 2. Roles & permissions
Resource `asset.valuation_snapshots` (+ `asset.market_value`/`insured_value`) — **Principal-only** (the canonical Manager-denied fields, F02). **Staff** `none`.

## 3. Data model
`V__valuation.sql`:
- **`asset_valuation_snapshots`** — `id, owner_id, asset_id → assets, kind ('acquisition'|'replacement'|'market'|'insured'|'appraisal'|'realised'), amount_minor bigint, currency, valued_at date, source text, confidence numeric null, document_ids uuid[], rationale text null, created_by, created_at`.
- Current `market_value`/`insured_value` derive from the latest snapshot of each kind.

## 4. API
`POST /api/assets/:id/valuations` · `GET /api/assets/:id/valuations` · aggregate `GET /api/valuations/summary?scope=collection|category|group|all`. (All Principal-gated.)

## 5. UI / screens & states
Fills the F04 **Valuation tab** (App. E.6): key facts (acquisition / current market / insured), **change since acquisition** (absolute + %), **Add snapshot**, valuation history list. Feeds Inventory summary "Estimated/Insured value" + Insights total value. States: no-valuation (placeholder), populated.

## 6. Business rules & validation
- Latest-by-kind defines current values; appraisal recency feeds data-quality (F23: "last appraisal under 24mo").
- `realised` set on disposal (F19 sold event).
- Multi-currency native; aggregate totals per currency (no silent FX) — cross-currency net-worth is the §19 open decision.
- Insured value vs market value distinct; insurance policy linkage in F21.

## 7. Integrations
F19 (appraisal/sale events → snapshots), F05 (appraisal docs), F29 (aggregate value), F21 (insured value ↔ policy), F23 (appraisal recency).

## 8. Edge cases
Conflicting same-day snapshots; downward revaluation; currency; appraisal vs market gap; group/collection rollup with mixed currencies.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Add a market valuation and verify current value + history**  ‹maps: `ValuationSnapshotIT`, web `asset-detail.spec` valuation-tab›
- **Given** Toby has an asset (a watch) with only an acquisition-cost valuation
- **When** he adds a new `market` valuation snapshot (amount, date, source, rationale)
- **Then** the Valuation tab shows the updated current market value and a change-since-acquisition figure (absolute + %)
- **And** the previous snapshot remains in the history list, and the new snapshot is audited.

**AC2 — Multiple snapshot kinds tracked independently**  ‹maps: `ValuationLatestByKindIT`›
- **Given** an asset with separate `acquisition`, `insured`, and `appraisal` snapshots
- **When** Toby adds a newer `market` snapshot
- **Then** only `market` current value updates; `insured` and `appraisal` remain at their prior amounts
- **And** every kind is shown in the Valuation tab's history list with its source and confidence.

**AC3 — Collection/category aggregate per currency (no silent FX)**  ‹maps: `ValuationAggregateIT`, web inventory Vitest›
- **Given** a collection with assets valued in GBP and SGD
- **When** Toby requests `GET /api/valuations/summary?scope=collection`
- **Then** the response returns separate GBP and SGD totals — no cross-currency rollup is silently applied
- **And** the Inventory summary "Estimated/Insured value" shows per-currency rows.

**AC4 — Stale appraisal surfaces in data-quality**  ‹maps: `AppraisalRecencyIT`, web `completeness.spec`›
- **Given** an asset whose last `appraisal` snapshot is more than 24 months old
- **When** the data-quality (F23) scan runs
- **Then** the asset is flagged with an "appraisal recency" issue visible in the Inbox data-quality stream
- **And** adding a fresh `appraisal` snapshot resolves the flag and updates the appraisal-recency bar in Insights.

**AC5 — Realised value set on disposal**  ‹maps: `RealisedValuationIT`›
- **Given** a sold-asset event is recorded via F19
- **When** the disposal event is committed
- **Then** a `realised` valuation snapshot is created with the sale amount and date, and no further snapshots of other kinds can be added
- **And** the operation is audited.

**AC6 — Manager and Staff cannot see or add valuations (negative)**  ‹maps: `ValuationAuthzIT`, web `asset-detail.spec` manager-denied›  *(invariant: valuation fields are Principal-private; no leak via totals)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either requests `GET /api/assets/:id/valuations` or attempts `POST /api/assets/:id/valuations`
- **Then** both receive **403** — the Valuation tab is not rendered, valuation amounts are field-stripped from all asset responses, and **aggregate totals do not expose individual valuations**
- **And** Marcia's asset list response contains no `market_value`, `insured_value`, or valuation-derived fields.

**AC7 — Same-day conflicting snapshots handled**  ‹maps: `ConflictingSnapshotIT`›
- **Given** two `market` snapshots added for the same asset on the same date
- **When** current value is derived
- **Then** the later-created snapshot wins as "current" for that kind
- **And** both remain in history, each audited.

## 10. Test plan
Backend (weaver+PG): latest-by-kind derivation, aggregate rollups per currency, field-level permission, appraisal-recency flag. Web: Vitest ValuationTab; Playwright add-valuation (Principal) + Manager-denied.

## 11. Observability & audit
Audit: snapshot add/edit. Metrics: assets valued/insured %, appraisal-recency distribution, total inventory value over time.

## 12. Open questions
1. Cross-currency net-worth view (§19 open). 2. External valuation feeds (auction indices) later. 3. Confidence scale definition.
