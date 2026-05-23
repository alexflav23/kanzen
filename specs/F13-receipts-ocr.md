# Feature F13 — Receipts, OCR/parse & learned categorisation

| | |
|---|---|
| **Feature ID** | F13 |
| **Milestone** | M3 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F05 (documents/S3), F04 (assets), F02 (authz); feeds F14 (reconciliation), F17 (expenses), F19 (asset creation); learning layer shared with F27 |
| **Spec references** | SPEC §9.2, §10.2 (Receipt), §10.4 (learned engine), §0 (v6.3); App. E.3/E.9 |

> **Decisions (v6.3, made):** OCR + line-item **extraction via Claude on Bedrock (multimodal)** → **versioned, correctable parse runs** (originals immutable, F05). **Auto-categorisation/auto-tagging is a hybrid that learns from confirmations**: deterministic vendor rules → **pgvector** nearest-neighbour over confirmed history → **Claude** for novel items, each with a **confidence**, human-in-the-loop, online-learning (no retraining). Adds **Bedrock model access (Claude + an embeddings model)** to `SETUP.md` (B4).

---

## 1. Purpose & user value
Turn a photographed or emailed receipt/invoice into structured, categorised, asset-linked data with almost no typing — and have it **get smarter every time you confirm**. After you've once tagged "Drake's silk tie → Clothing/`bespoke`", the next one is suggested correctly. This is the engine behind effortless expense capture, asset creation from receipts, and reconciliation.

## 2. Roles & permissions
Resources `receipt`, `receipt_line_item` (Principal-private with Manager operational, F02): **Principal** `admin`; **Manager** `write` — upload, parse, review/confirm line items, link to assets (operational, per §4); **Staff** `none`. Confirmed amounts are operational (visible to Manager); downstream valuation stays Principal-only (F20).

## 3. Data model
`V__receipts.sql` (+ pgvector):
- **`receipts`** — `id, owner_id, document_id → documents (immutable original, F05), kind ('receipt'|'invoice'), merchant_id uuid null → merchants, purchased_at date null, subtotal_minor bigint null, tax_minor bigint null, total_minor bigint null, currency text, source ('agent'|'manual'|'import'), status ('parsing'|'needs_review'|'confirmed'|'failed'), created_at, deleted_at`.
- **`receipt_parse_runs`** — `id, receipt_id, version int, model text (e.g. claude-on-bedrock + schema version), status ('success'|'failed'|'superseded'), raw_extraction jsonb, overall_confidence numeric, created_by ('system'|user), created_at`. **Versioned**; re-parse supersedes, never overwrites; originals untouched.
- **`receipt_line_items`** — `id, receipt_id, parse_run_id, line_no int, description text, qty numeric, unit_price_minor bigint null, total_minor bigint, tax_minor bigint null, currency text, suggested_category_id uuid null, suggested_tags jsonb, suggestion_confidence numeric, suggestion_source ('rule'|'history'|'claude'), confirmed_category_id uuid null, confirmed_tags jsonb, asset_link_id uuid null (→ asset, F04), status ('suggested'|'confirmed'|'ignored'), created_at`.
- **`line_item_memory`** (pgvector — the learned store) — `id, owner_id, vendor_norm text, text_norm text, embedding vector(N), confirmed_category_id, confirmed_tags jsonb, source_line_item_id, created_at`. Built only from **confirmed** items; the retrieval corpus. HNSW/IVF index.
- Reuses **`merchants`** (F12) for normalisation; **`document_links`** (F05) ties the receipt to assets/transactions.

## 4. API (Tapir endpoints)
- `POST /api/receipts` — from an uploaded document (F05): create + enqueue parse. `GET /api/receipts` / `:id` (with current line items). `GET /api/receipts/:id/parse-runs`.
- `POST /api/receipts/:id/reparse` — new versioned parse run.
- `PATCH /api/receipt-line-items/:id` — edit description/amounts; **confirm** category/tags; **link to asset** (create or attach, F04); `ignore`.
- `POST /api/receipts/:id/confirm` — confirm the receipt (all line items) → triggers learning + downstream (reconciliation F14, expense/associated-cost F17, asset F19).
- `POST /api/categorisation/suggest` — internal: given `(vendor, line-item text)`, return suggestion + confidence + source (used by the pipeline and the rules engine F27).

## 5. UI / screens & states
Receipts surface mostly through the **Inbox** (agent receipt proposals + reconciliation + data-quality) and **Documents** (the original); plus a **receipt detail**:
- **Agent proposal / Triage** (App. E.3): the email excerpt → **agent-extracted** header + line items (editable) → proposed actions (file document, create line items, propose assets, reconcile) → Confirm.
- **Receipt detail**: the original preview (F05) beside the parsed line-item table; each line shows **suggested category/tags with a confidence + source chip** (rule / history / Claude), editable; **confirm** per line or whole receipt; **link to asset**; **re-parse** (shows parse-run version). 
- **States**: parsing (spinner), needs-review (low confidence highlighted), confirmed, failed (manual entry fallback); cold-start (no history → rule/Claude suggestions only); "N line items pending → asset" (prototype Documents tile).

## 6. Business rules & validation
- **Extraction**: Claude multimodal reads the immutable original; structured-output schema (header + lines). Optional **Textract** pre-pass for poor scans. Low `overall_confidence` → `needs_review`.
- **Categorisation (layered, per line item)**: (1) **rules** (merchant/keyword → category/tags, F27); (2) **history retrieval** — embed `(vendor_norm + text_norm)`, nearest-neighbour in `line_item_memory`, borrow the majority category/tags with a confidence; (3) **Claude** for novel/low-confidence items, given the closest historical examples in-context. Highest-confidence suggestion wins; **source recorded**.
- **Learning loop**: on **confirm**, write/refresh a `line_item_memory` row (embedding of vendor+text → confirmed category/tags). Suggestions improve with use; no batch retraining.
- **Auto-apply**: above a per-category **confidence threshold** (configurable, trust model §10.3), a suggestion may auto-confirm; **asset/financial creation never auto-commits** (always proposed).
- **Originals immutable**; corrections = edits to derived line items or a new parse run.
- **Line item → asset**: a line item maps to 0/1/many assets (e.g. "6 tumblers" → one grouped asset; "tea set" → structured set) — proposed, confirmed by a human (F19/F24).
- **Privacy**: all inference on **Bedrock eu-west-1**; embeddings stored in our pgvector; no third party.

## 7. Integrations / external systems
- **Bedrock**: Claude (multimodal extraction + novel-item categorisation) + an **embeddings model** (Titan/Cohere). IAM role; model access enabled (SETUP B4). 
- **Textract** (optional pre-OCR) — AWS.
- **pgvector** (F00/F14 RDS) for the learned store.
- **Gmail agent** (F25) supplies emailed receipts (source=`agent`); **F05** stores originals.

## 8. Edge cases
- Poor/blurry scan → low confidence → needs-review + manual edit; Textract fallback.
- Multi-page invoice; multi-currency receipt; tax-inclusive vs exclusive; discounts/negative lines; rounding (minor units).
- Split a line item; merge duplicate receipts (same merchant/date/total) → dedup prompt.
- Cold start (no history) → rules + Claude only; confidence lower.
- Conflicting history (same item categorised differently before) → surface both, ask.
- Re-parse after a model upgrade → new version; prior confirmations preserved.
- Embedding model change → re-embed memory (migration job).

## 9. Acceptance criteria
- **AC1** Uploading a receipt photo produces structured line items via Claude, stored as a versioned parse run; the original is immutable.
- **AC2** After confirming "Drake's tie → Clothing/`bespoke`" once, a later Drake's tie line item is **auto-suggested** the same category/tags with a high confidence and source=`history`.
- **AC3** A novel item with no rule/history gets a Claude suggestion (source=`claude`) at lower confidence, flagged for review.
- **AC4** Confirming a line item writes to `line_item_memory`; re-running suggestion for a similar item now hits history.
- **AC5** A "6 tumblers" line item proposes one grouped asset (×6), confirmed by a human.
- **AC6** Re-parse creates a new version without altering the original or losing prior confirmations.
- **AC7** All inference runs on Bedrock in eu-west-1 (no external calls).

## 10. Test plan
- **Backend** (weaver + testcontainers-PG **with pgvector**; Bedrock mocked): schema-validated extraction parsing; the three-layer suggestion engine (rule vs history vs Claude precedence + confidence); learning loop (confirm → memory → subsequent retrieval hit); versioned re-parse; line-item→asset proposal; multi-currency/tax math; dedup.
- **Web**: Vitest for the line-item review table (suggestion chips, confidence, confirm); Playwright e2e upload→parse→confirm→learning-improves.
- **Quality**: a fixture corpus of receipts to measure suggestion accuracy improving with confirmations.

## 11. Observability & audit
- Audit: parse run created, line-item confirm/edit/ignore, asset link, re-parse, auto-applied suggestions.
- Metrics: extraction success/confidence distribution, suggestion source mix (rule/history/claude), **suggestion acceptance rate over time** (the learning signal), per-item Bedrock cost/latency, memory size.

## 12. Open questions / decisions
1. **Embeddings model** — Bedrock **Titan Embeddings** vs **Cohere** (dimension, cost, multilingual). 
2. **Auto-apply confidence thresholds** — per-category defaults; how aggressive (ties to §19 #6 inference aggressiveness).
3. **Textract** — include the pre-OCR fallback in v1 or rely on Claude multimodal alone.
4. **Tax modelling depth** — line vs receipt-level tax; VAT/GST handling for UK/SG.
5. **Line-item → asset automation** — proposed-only (lean) vs auto-create above confidence.
