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
- **NL query**: `POST /api/nl-query` — Claude (Bedrock), given the **schema/domain knowledge** + the caller's **permission context**, translates the prompt into a **validated structured query** over F28/F29's model, executes it **read-only**, and returns results + the interpreted query (transparent, correctable). Handles aggregates/temporal questions like **"how many guitars do I have?"**, **"how much did I pay for them?"**, **"when did I last buy shoes?"**. Never mutates; never bypasses F02 (a Manager's NL query can't surface valuations). *(NL-to-**action** — "add eggs to the list" — is a deliberate future extension, human-confirmed; v1 is read-only.)*
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

## 9. Acceptance criteria
- **AC1** An English question returns correct, **permission-filtered** results plus the interpreted structured query (editable); a Manager's NL query cannot reveal valuations.
- **AC2** NL is strictly read-only and validated against the schema (no injection, no mutation).
- **AC3** Bulk onboarding turns a photo batch into reviewable draft assets via OCR + AI fill (human-confirmed).
- **AC4** Optional Drive export mirrors documents/export without becoming a source-of-truth.

## 10. Test plan
Backend (weaver+PG; Bedrock mocked): NL→structured-query translation + **schema validation + permission filtering (leak tests)**; read-only enforcement; bulk batch → drafts; Drive export (mocked). Web: Vitest NL bar (interpretation display/edit) + onboarding wizard; Playwright NL query + scoped-result assertions.

## 11. Observability & audit
Audit: bulk-onboarding confirmations, Drive exports. Metrics: NL query volume + interpretation accuracy/correction rate, bulk-onboarding throughput, Drive export usage. `nl_query_log` for tuning.

## 12. Open questions
1. NL guardrails (schema-validate every generated query; deny-by-default). 2. Bulk-onboarding AI cataloguing depth. 3. Drive export scope (full archive vs selected docs). 4. Whether NL graduates from "advanced" to a core surface once trusted.
