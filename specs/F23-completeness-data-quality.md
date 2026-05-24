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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Per-asset completeness score and improve hints**  ‹maps: `CompletenessScoreIT`, web `asset-detail.spec` completeness-bar›
- **Given** an asset with a photo, category, and location but no proof/receipt and no valuation
- **When** Toby opens the asset detail
- **Then** the hero shows a completeness bar (e.g. 55%) and "Improve: add receipt, add valuation"
- **And** adding a receipt and a valuation snapshot recomputes the score upward on the next scan.

**AC2 — Registry-health aggregate in Insights**  ‹maps: `RegistryHealthIT`, web `insights.spec` registry-health›
- **Given** a registry with a mix of complete and incomplete assets
- **When** Toby opens **Insights → Registry health**
- **Then** he sees bars for photographed %, categorised %, located %, proof %, insured %, appraisal-recency %
- **And** the Inventory summary shows overall completeness % + "N expensive missing proof".

**AC3 — Suspected-duplicate flag raised and resolved by merge**  ‹maps: `DuplicateDetectionIT`, web `inbox.spec` data-quality›
- **Given** Lorna creates two assets both titled "Dyson V15" within 24 hours
- **When** the detection scan runs
- **Then** a `suspected_duplicate` flag appears in the Inbox data-quality stream referencing both assets
- **And** performing a merge (F24) on the two assets resolves the flag automatically.

**AC4 — Anomaly: invoice 80% above prior for merchant/category**  ‹maps: `AnomalyDetectionIT`›
- **Given** prior invoices from a utilities vendor average £2,300
- **When** a new £4,200 invoice (≈ 83% above) is filed against the same merchant/category
- **Then** an `anomaly` flag is raised in the Inbox data-quality stream with the deviation detail
- **And** the flag is dismissible (false positive) and dismissing it does not suppress future anomalies for that category.

**AC5 — Expensive asset missing proof in Inbox with fix action**  ‹maps: `ExpensiveNoProofIT`, web `inbox.spec` data-quality›
- **Given** an asset valued above the "expensive" threshold with no authenticity documents or receipt
- **When** the scan runs
- **Then** an `expensive_no_proof` flag (severity=high) appears in the Inbox with a "Fix: add proof document" action
- **And** uploading a certificate document resolves the flag and recomputes the asset's completeness score.

**AC6 — Resolve and dismiss flags**  ‹maps: `FlagResolveDismissIT`›
- **Given** an open `missing_photo` flag for an asset
- **When** Lorna clicks Resolve after adding a photo, and separately dismisses a `suspected_duplicate` false-positive
- **Then** the resolved flag status → `resolved` (with `resolved_at`); the dismissed flag status → `dismissed`
- **And** both transitions are audited and the flag does not reappear on the next scan.

**AC7 — Manager sees operational completeness; valuation-derived parts withheld (negative)**  ‹maps: `CompletenessManagerAuthzIT`›  *(invariant: valuation fields are Principal-private; no leak via totals)*
- **Given** Lorna (Manager) viewing the Inbox data-quality stream and the Inventory summary
- **When** completeness scores are rendered for her
- **Then** the scores omit the valuation-derived weights (insured-value check, appraisal-recency check) — these factors do not appear in her view
- **And** the Insights registry-health page does not show the "insured %" or "appraisal-recency %" bars to Lorna.

**AC8 — Staff has no access to data-quality stream (negative)**  ‹maps: `DataQualityStaffAuthzIT`›
- **Given** Marcia (Staff)
- **When** she requests `GET /api/data-quality?stream`
- **Then** she receives **403** and no flag data is included in any response she receives.

## 10. Test plan
Backend (weaver+PG+pgvector): score computation + weights (Manager vs Principal), each detector (missing/expensive/duplicate/anomaly), recompute triggers. Web: Vitest data-quality stream + completeness bar; Playwright resolve-flow.

## 11. Observability & audit
Audit: flag resolve/dismiss. Metrics: overall completeness, flags by kind/severity, duplicate/anomaly precision (dismiss rate), time-to-resolve.

## 12. Open questions
1. Completeness weightings. 2. Duplicate detection method (heuristic vs embeddings — lean: both). 3. Expensive threshold per currency. 4. Anomaly sensitivity (§19 #6 inference aggressiveness).
