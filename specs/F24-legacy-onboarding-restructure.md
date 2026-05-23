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

## 9. Acceptance criteria
- **AC1** Create a legacy asset with approximate cost, no receipt, and an uncertainty note; it's valid and flagged for completeness.
- **AC2** Bulk-import a spreadsheet of 50 items → preview → commit as drafts.
- **AC3** Merge two duplicate "Dyson V15" assets → one asset, both lineages + cost basis preserved, operation audited + reversible.
- **AC4** Split a "set of 6 tumblers" into 6 individual assets with cost allocated; history explainable.
- **AC5** No restructure silently deletes data; cost basis/valuation remain attributable.

## 10. Test plan
Backend (weaver+PG): legacy relaxed validation; bulk import map/commit; merge/split/regroup/convert/reallocate cost-basis math + lineage preservation + reversibility; audit completeness. Web: Vitest import mapper + restructure preview; Playwright legacy create + merge.

## 11. Observability & audit
Audit: every legacy create, import batch, and restructure op (before/after cost basis). Metrics: legacy assets, import volume/success, restructures by kind, reversals.

## 12. Open questions
1. Reversibility scope (which ops are undoable). 2. Bulk-import formats/templates. 3. Cost-allocation defaults on split/convert (even vs manual).
