# Feature F23 — Completeness scoring & data quality

| | |
|---|---|
| **Feature ID** | F23 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04, F19, F20, F21, F22; surfaces in F26 (Inbox), F29 (Insights) |
| **Spec references** | SPEC §8.9, §13; `input/views/inbox.jsx → DataQualityStream`, `assets.jsx`, App. E.3/E.5/E.10 |

> **Decisions (revisitable):** a per-asset **completeness score** (0–100%) + reasons; **registry-health** aggregate; **data-quality detection** — missing photo/category/location/proof, **expensive-missing-proof**, **suspected duplicates**, **anomalies** — surfaced in the Inbox Data-quality stream, Inventory summary, asset hero, and Insights.

## 1. Purpose & user value
Keeps the registry honest and improving — shows what's incomplete or suspicious without nagging, turning "is this archive any good?" into a number and a short to-do.

## 2. Roles & permissions
Computed for Principal-private registry; Manager sees operational completeness (not valuation-derived parts). Staff none.

## 3. Data model
`V__data_quality.sql`:
- **Completeness**: computed (rules) per asset — weighted checks (photo, category, location+sub, proof/receipt, insured value†, appraisal recency†) (†Principal-only weight). Cached as `asset_completeness (asset_id, score, missing jsonb, computed_at)`.
- **`asset_quality_flags`** — `id, owner_id, asset_id null, kind ('missing_photo'|'missing_location'|'missing_proof'|'expensive_no_proof'|'suspected_duplicate'|'anomaly'|'no_category'), severity ('low'|'medium'|'high'), detail jsonb, status ('open'|'resolved'|'dismissed'), resolved_at null, created_at`.

## 4. API
`GET /api/assets/:id/completeness` · `GET /api/data-quality?stream` (Inbox) · `POST /api/data-quality/:flagId/resolve|dismiss` · `GET /api/insights/registry-health`.

## 5. UI / screens & states
- **Inbox → Data quality stream** (App. E.3): completeness header + severity-coded issue rows (kind, count, affected assets, one-line fix → Resolve).
- **Inventory** summary: completeness % + "N expensive missing proof"; filter-rail data-quality nudge.
- **Asset hero**: completeness bar + "Improve: …" hint.
- **Insights → Registry health** (App. E.10): photographed/categorised/located/proof/insured/appraisal-recency bars.

## 6. Business rules & validation
- **Score** = weighted sum of satisfied checks; reasons list the unmet ones.
- **Detection**: missing fields (rule); **expensive-missing-proof** (above threshold, F21); **suspected duplicates** (similar title/maker/serial within a window — heuristic + optional embeddings, reusing F13's vector approach); **anomalies** (price/cost far from prior for the merchant/category — ties F13/F14).
- Flags are dismissible (false positives) and resolvable (fix → recompute).
- Recompute on asset change + a periodic scan.

## 7. Integrations
F04/F19/F20/F21/F22 (inputs), F13 (embeddings for duplicates/anomalies), F26 (Inbox stream), F29 (registry-health), F24 (duplicate → merge).

## 8. Edge cases
Duplicate false positives (dismiss + learn); legacy assets intentionally incomplete (suppress until reviewed); expensive threshold per currency; anomaly tuning; completeness weighting for Manager (no valuation parts).

## 9. Acceptance criteria
- **AC1** Each asset shows a completeness % + improve hints; aggregate registry-health renders in Insights.
- **AC2** Two "Dyson V15" assets created within 24h flag as a suspected duplicate; merging (F24) resolves it.
- **AC3** An £4,200 invoice 80% above prior flags an anomaly.
- **AC4** Expensive assets missing proof appear in the Inbox data-quality stream with a fix action.
- **AC5** Resolving/dismissing a flag updates state + recomputes.

## 10. Test plan
Backend (weaver+PG+pgvector): score computation + weights (Manager vs Principal), each detector (missing/expensive/duplicate/anomaly), recompute triggers. Web: Vitest data-quality stream + completeness bar; Playwright resolve-flow.

## 11. Observability & audit
Audit: flag resolve/dismiss. Metrics: overall completeness, flags by kind/severity, duplicate/anomaly precision (dismiss rate), time-to-resolve.

## 12. Open questions
1. Completeness weightings. 2. Duplicate detection method (heuristic vs embeddings — lean: both). 3. Expensive threshold per currency. 4. Anomaly sensitivity (§19 #6 inference aggressiveness).
