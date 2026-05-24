# Feature F32 — Advanced: bulk onboarding, natural-language query, Drive export

| | |
|---|---|
| **Feature ID** | F32 |
| **Milestone** | M10 |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | F24 (restructure), F28 (search/semantic), F29 (structured model), F30 (export) |
| **Spec references** | SPEC §17 (M10), §7.12; builds on F28/F29 |

> **Decisions (revisitable):** the "depth later" milestone — **bulk onboarding of legacy collections** (beyond F24's import: assisted/AI-aided cataloguing), a **natural-language query layer** over the structured model (Claude → structured query → existing search/insights, *read-only, permission-filtered*), deeper workflow automation, and **optional Google Drive export** (export-only, per §3.2). All additive; nothing here is required for v1 success criteria.

## 1. Purpose & user value
The polish and scale features once the core is solid: get a whole existing collection in fast (photo-batch + AI cataloguing), ask the registry questions in plain English ("what did we spend on the watches last year, and what's uninsured?"), automate more of the routine, and optionally mirror documents to Drive for reach.

## 2. Roles & permissions
NL query + bulk tools are **permission- and scope-filtered** (a Manager's NL query can't surface valuations); Drive export is Principal-controlled. All read-only where it matters; writes go through normal human-in-the-loop paths.

## 3. Data model
Minimal new state: `nl_query_log` (id, owner_id, prompt, resolved_query jsonb, result_summary, created_at) for tuning; bulk-onboarding reuses F24's `asset_import_batches`/`rows` + F13 OCR; Drive export reuses F30 export + a Drive target config.

## 4. API
- **NL query**: `POST /api/nl-query` — Claude (Bedrock), given the **schema/domain knowledge** + the caller's **permission context**, translates the prompt into a **validated structured query** over F28/F29's model — which spans assets, transactions **and receipt line items resolved to products/brands** (F13 `brand_norm`/`product_id`) — executes it **read-only**, and returns results + the interpreted query (transparent, correctable). Handles aggregates/temporal questions like **"how many guitars do I have?"**, **"how much did I pay for them?"**, **"when did I last buy shoes?"**, and **product-level spend like "how much did I spend on Coca-Cola this year?"** (sums all matching line items, FX-normalised). Never mutates; never bypasses F02 (a Manager's NL query can't surface valuations). *(NL-to-**action** — "add eggs to the list" — is a deliberate future extension, human-confirmed; v1 is read-only.)*
- **Bulk onboarding**: `POST /api/onboarding/batch` — photo/spreadsheet batch → OCR (F13) + AI field-fill → draft assets (F24) for review.
- **Drive export**: `POST /api/backup/export/drive` — push an export (or selected documents) to a configured Google Drive folder (export-only).

## 5. UI / screens & states
- **NL query bar** — surfaced both in Insights and as a mode of the **⌘K search box (F28)** (a leading `?` or natural sentence routes to NL): ask in English → see the interpreted structured query (editable) + results; "save as smart filter" (F28).
- **Bulk onboarding wizard**: batch capture/upload → AI-suggested catalogue → review/confirm drafts (F24).
- **Settings → Export to Drive** (optional): connect a Drive folder, choose what to mirror. States: interpreting, results, low-confidence (show the query for correction), exporting.

## 6. Business rules & validation
- **NL is a thin, transparent layer**: Claude → structured query → existing permission-filtered search/insights; the interpreted query is shown and editable; **no hidden-data leakage** (same F02 filtering as F28/F29); read-only.
- **Bulk onboarding**: AI proposes, human confirms (no silent creation); legacy uncertainty preserved (F24).
- **Drive**: **export-only/optional** — never a system-of-record (§3.2); originals stay immutable in S3.

## 7. Integrations
Bedrock (NL→query, batch field-fill), F28 (semantic/structured search), F29 (insights model), F24 (drafts/restructure), F13 (OCR), F30 + Google Drive (optional export).

## 8. Edge cases
NL ambiguity (show interpretation, ask to refine); NL that would touch hidden data (filtered, explained); hallucinated query (validated against the schema before execution); huge bulk batches (chunked); Drive auth/folder permissions; partial export to Drive.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — NL query returns permission-filtered results and shows the interpreted structured query**  ‹maps: `NLQueryPermissionIT`, web `advanced.spec` nl-query›  *(invariant: search, aggregates and NL queries are permission/scope-filtered server-side — no leak via totals)*
- **Given** Toby asks "what did we spend on the watches last year, and what's uninsured?"
- **When** the NL query resolves via Claude → structured query → F28/F29
- **Then** correct, permission-filtered results are returned, including Toby's spend figures and uninsured flag
- **And** the interpreted structured query is displayed and editable; no data Toby cannot see appears.

**AC2 — Manager's NL query cannot reveal valuations or cross-property data**  ‹maps: `NLQueryManagerScopeIT`, web `advanced.spec` nl-scope›  *(invariant: search, aggregates and NL queries are permission/scope-filtered server-side — no leak via totals)*
- **Given** Lorna (Manager) issues "show me the total value of all assets across both properties"
- **When** the NL query resolves
- **Then** valuations are excluded from Lorna's results (server-side, same F02 filter as F28); her result shows operational data only
- **And** the interpreted query does not include `valuation` fields; the result never leaks via aggregates or totals.

**AC3 — NL query is strictly read-only and schema-validated; no injection or mutation**  ‹maps: `NLQueryReadOnlyIT`, web `advanced.spec` nl-readonly›
- **Given** a crafted NL prompt that attempts to trigger a mutation ("delete all expenses")
- **When** the NL layer resolves it
- **Then** the generated structured query is validated against the schema and rejected if it contains any write operation
- **And** no domain records are mutated; the validation rejection is returned to the user with an explanation.

**AC4 — Bulk onboarding produces reviewable draft assets; human confirms before creation**  ‹maps: `BulkOnboardingIT`, web `advanced.spec` bulk-onboard›  *(invariant: asset creation never auto-commits)*
- **Given** Toby uploads a batch of 20 asset photos
- **When** the batch pipeline runs (OCR + AI field-fill via F13)
- **Then** 20 draft asset records appear in the review wizard (F24), each with AI-suggested fields editable
- **And** none are committed to the registry until Toby confirms each; rejected drafts are discarded without trace in the asset table.

**AC5 — Drive export is export-only; originals remain immutable in S3**  ‹maps: `DriveExportIT`, web `advanced.spec` drive-export›  *(invariant: agent files to S3, never Drive; source documents are immutable)*
- **Given** Toby triggers a Drive export of selected documents
- **When** the export completes
- **Then** copies appear in the configured Drive folder, but S3 remains the system of record
- **And** the original S3 objects are unchanged; Kanzen never reads back from Drive; Drive is never treated as authoritative.

**AC6 — Drive export is Principal-only (negative)**  ‹maps: `DriveExportAuthzIT`›
- **Given** Lorna (Manager) attempts to trigger a Drive export
- **When** she calls `POST /api/backup/export/drive`
- **Then** she receives a 403; no export job is created
- **And** the attempt is audited.

## 10. Test plan
Backend (weaver+PG; Bedrock mocked): NL→structured-query translation + **schema validation + permission filtering (leak tests)**; read-only enforcement; bulk batch → drafts; Drive export (mocked). Web: Vitest NL bar (interpretation display/edit) + onboarding wizard; Playwright NL query + scoped-result assertions.

## 11. Observability & audit
Audit: bulk-onboarding confirmations, Drive exports. Metrics: NL query volume + interpretation accuracy/correction rate, bulk-onboarding throughput, Drive export usage. `nl_query_log` for tuning.

## 12. Open questions
1. NL guardrails (schema-validate every generated query; deny-by-default). 2. Bulk-onboarding AI cataloguing depth. 3. Drive export scope (full archive vs selected docs). 4. Whether NL graduates from "advanced" to a core surface once trusted.
