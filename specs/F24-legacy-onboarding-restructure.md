# Feature F24 — Legacy onboarding & restructure

| | |
|---|---|
| **Feature ID** | F24 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets), F19 (events), F20 (valuation), F13 (receipts) |
| **Spec references** | SPEC §8.8; `input/views/assets.jsx` (Bulk import / New asset), `asset-detail.jsx` (Restructure) |

> **Decisions (revisitable):** **legacy onboarding** is first-class (create assets with no receipt, approximate date/cost, unknown merchant, uncertainty note); **bulk import** (CSV/spreadsheet); **restructure ops** (merge / split / regroup / convert quantity↔structured / reallocate costs & receipt links) are **auditable and reversible**, never silently destructive — original identifiers and cost-basis/valuation history stay explainable.

## 1. Purpose & user value
Get years of existing possessions into the registry without perfect paperwork, and reshape groupings later (split a "set of 6" into individually-sold pieces, merge accidental duplicates) without losing the financial and provenance trail.

## 2. Roles & permissions
Resource `asset` (Manager `write` for legacy create + bulk import; restructure ops audited; valuation reallocation Principal). Staff none.

## 3. Data model
`V__restructure.sql`:
- **`restructure_operations`** — `id, owner_id, kind ('merge'|'split'|'regroup'|'convert'|'reallocate'), inputs jsonb (source asset/group ids + allocations), outputs jsonb (resulting ids), cost_basis_before jsonb, cost_basis_after jsonb, performed_by, performed_at, reversible bool, reversed_by uuid null`.
- Assets keep lineage: `original_quantity` (F04), `parent_asset_id`, plus `restructured_from uuid[]` (lineage); cost basis + valuation history preserved/explained.
- **Bulk import**: a staging table `asset_import_batches` + `asset_import_rows` (raw → mapped → created drafts).

## 4. API
- **Legacy create**: `POST /api/assets?mode=legacy` (relaxed validation — approximate fields + `uncertainty_note`).
- **Bulk import**: `POST /api/assets/import` (upload + column map → preview → commit drafts).
- **Restructure**: `POST /api/assets/merge` · `/split` · `/regroup` · `/convert` · `/reallocate` — each writes a `restructure_operation` (explainable) and is **reversible** where feasible.

## 5. UI / screens & states
- Inventory **"Bulk import"** + **"New asset"** (legacy flow: minimal required fields, uncertainty note, "Inherited …" provenance).
- Asset detail **Quick action → Restructure**: guided merge/split/regroup/convert/reallocate with a before/after preview and a "history preserved" assurance.
- States: import (map/preview/commit/errors), restructure preview/confirm/undo.

## 6. Business rules & validation
- **Legacy**: an asset may have no receipt/transaction, approximate `acquisition_date`/`acquisition_cost`, unknown merchant, partial docs, an `uncertainty_note`; flagged for data-quality (F23) but valid.
- **Restructure is non-destructive**: originals are superseded/linked, never deleted; cost basis is **reallocated explicitly** (allocations sum to the original); valuation/provenance history remains attributable; every op is audited and (where feasible) reversible.
- **Merge** preserves both lineages + combined cost basis; **split** allocates cost across children; **convert** quantity→structured creates children with allocated cost; **regroup** moves group membership.

## 7. Integrations
F04 (assets/groups), F19 (events/lineage), F20 (valuation reallocation), F13 (receipt-link reallocation), F23 (legacy → quality flags; duplicate → merge), F30 (backup preserves lineage).

## 8. Edge cases
Merge of assets with different currencies/cost bases; split rounding; convert with existing events; reallocate receipt links across merged assets; undo a restructure; bulk import partial failures; duplicate detection (F23) → guided merge.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Create a legacy asset with approximate data and uncertainty note**  ‹maps: `LegacyCreateIT`, web `assets.spec` legacy-form›
- **Given** Lorna opens the New asset form in legacy mode
- **When** she submits with an approximate acquisition date (year only), an estimated cost, no receipt, no merchant, and an uncertainty note "Inherited from grandmother c. 1990"
- **Then** the asset is created as valid in the registry, with `uncertainty_note` populated
- **And** a `missing_proof` completeness flag is raised (F23) and the asset shows a lower completeness score, but the record itself is not blocked.

**AC2 — Bulk-import 50 items: map → preview → commit as drafts**  ‹maps: `BulkImportIT`, web `assets.spec` bulk-import›
- **Given** a CSV/spreadsheet with 50 asset rows and mixed columns
- **When** Lorna uploads it, maps columns to Kanzen fields in the import UI, reviews the preview (showing validation warnings), and commits
- **Then** 50 draft assets are created in `asset_import_rows` and promoted to `assets` in the committed batch
- **And** rows with unmappable required fields are listed as errors and skipped, not silently imported.

**AC3 — Merge two duplicate assets: lineage + cost basis preserved, audited + reversible**  ‹maps: `MergeIT`, web `asset-detail.spec` restructure›
- **Given** two "Dyson V15" assets each with their own cost basis and acquisition events
- **When** Toby triggers a merge via the Restructure action
- **Then** one asset remains, both lineages are preserved in `restructured_from`, and the combined cost basis is correctly summed and stored in `restructure_operations`
- **And** the operation is audited (before/after cost basis), and a reversal restores both originals.

**AC4 — Split a "set of 6 tumblers" into 6 individual assets**  ‹maps: `SplitIT`›
- **Given** an asset "Set of 6 crystal tumblers" with a cost basis of £600 and an acquisition event
- **When** Lorna performs a split into 6 children with even cost allocation (£100 each)
- **Then** 6 new assets are created, each with `parent_asset_id` pointing to the original, and cost basis allocated correctly
- **And** the original asset is superseded/linked (not deleted), the split is audited, and the 6 children's cost basis sums to £600.

**AC5 — No restructure silently destroys data (invariant)**  ‹maps: `RestructureNonDestructiveIT`›
- **Given** a regroup operation moving assets between groups
- **When** the regroup is committed
- **Then** all original `restructure_operations` records (inputs/outputs/cost_basis_before/cost_basis_after) are retained
- **And** valuation history and provenance documents remain attributable to the original lineage — no asset row is hard-deleted.

**AC6 — Valuation reallocation on split is Principal-only (negative)**  ‹maps: `RestructureValuationAuthzIT`›  *(invariant: valuation reallocation is Principal-only; no leak)*
- **Given** a split operation that includes reallocating a valuation snapshot across children
- **When** Lorna (Manager) attempts to commit the valuation reallocation step
- **Then** she receives **403** on the reallocation sub-action
- **And** the non-valuation parts of the restructure (lineage/cost basis) proceed normally if Lorna initiates them within her write permission.

**AC7 — Bulk-import partial failure: errors listed, successes committed**  ‹maps: `BulkImportPartialIT`›
- **Given** a CSV of 50 rows where 5 rows have a missing required field (e.g. no title)
- **When** Lorna commits the import
- **Then** 45 assets are created as drafts; the 5 failing rows are returned as errors with row numbers and field details
- **And** re-uploading a corrected CSV for only the 5 failed rows is accepted.

**AC8 — Undo a merge restores both originals**  ‹maps: `MergeReversalIT`›
- **Given** a completed merge operation marked `reversible = true`
- **When** Toby reverses the merge
- **Then** both original assets are restored with their pre-merge cost bases, valuations, and events
- **And** the reversal is audited with `reversed_by` and timestamp set on the `restructure_operations` record.

## 10. Test plan
Backend (weaver+PG): legacy relaxed validation; bulk import map/commit; merge/split/regroup/convert/reallocate cost-basis math + lineage preservation + reversibility; audit completeness. Web: Vitest import mapper + restructure preview; Playwright legacy create + merge.

## 11. Observability & audit
Audit: every legacy create, import batch, and restructure op (before/after cost basis). Metrics: legacy assets, import volume/success, restructures by kind, reversals.

## 12. Open questions
1. Reversibility scope (which ops are undoable). 2. Bulk-import formats/templates. 3. Cost-allocation defaults on split/convert (even vs manual).
