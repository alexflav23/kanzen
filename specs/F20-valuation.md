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

## 9. Acceptance criteria
- **AC1** Adding a market valuation updates current value + change-since-acquisition; history retained.
- **AC2** Manager cannot see/add valuations (403/field-stripped); Principal can.
- **AC3** Collection/category value aggregates per currency.
- **AC4** A stale appraisal (>24mo) surfaces in data-quality (F23).

## 10. Test plan
Backend (weaver+PG): latest-by-kind derivation, aggregate rollups per currency, field-level permission, appraisal-recency flag. Web: Vitest ValuationTab; Playwright add-valuation (Principal) + Manager-denied.

## 11. Observability & audit
Audit: snapshot add/edit. Metrics: assets valued/insured %, appraisal-recency distribution, total inventory value over time.

## 12. Open questions
1. Cross-currency net-worth view (§19 open). 2. External valuation feeds (auction indices) later. 3. Confidence scale definition.
