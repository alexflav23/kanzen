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
- **`receipt_line_items`** — `id, receipt_id, parse_run_id, line_no int, description text, qty numeric, unit_price_minor bigint null, total_minor bigint, tax_minor bigint null, currency text, suggested_category_id uuid null, suggested_tags jsonb, suggestion_confidence numeric, suggestion_source ('rule'|'history'|'claude'), confirmed_category_id uuid null, confirmed_tags jsonb, brand_norm text null, product_id uuid null (→ products, F35), asset_link_id uuid null (→ asset, F04), status ('suggested'|'confirmed'|'ignored'), created_at`. *(`brand_norm` + optional `product_id` resolve each line to a normalised product/brand — the "spend by product" backbone for NL/insights.)*
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
- **Product/brand resolution**: alongside category/tags, the ML layer **normalises each line to a product/brand** (`brand_norm`, e.g. "Coca-Cola") and, where it matches the consumables catalogue, links `product_id` (F35) — the same normalise-on-confirm-and-learn loop as merchants. Every "Coca-Cola" line across every receipt resolves to the **same** product/brand, so historical **spend-by-product** is reliably aggregatable (surfaced via F28 search, F29 insights and F32 NL query — not fuzzy text matching).
- **Auto-apply**: above a per-category **confidence threshold** (configurable, trust model §10.3), a suggestion may auto-confirm; **asset/financial creation never auto-commits** (always proposed).
- **Originals immutable**; corrections = edits to derived line items or a new parse run.
- **Line item → asset (inventory promotion)**: a line item maps to 0/1/many assets (e.g. "6 tumblers" → one grouped asset; "tea set" → structured set) — **proposed, never auto-committed**, confirmed by a human (F19/F24). On promotion the asset **carries provenance**: line `total`→`acquisition_cost`, receipt `merchant`/`purchased_at`→acquisition merchant/date, the **immutable receipt as the proof document** (F05 → asset `hero_document_id`/`document_link`), and any warranty terms → **F21**; this feeds valuation (**F20**) and lifetime cost (**F19**). The system **suggests which lines are inventory-worthy** (durable goods vs consumables) via the same ML categorisation layer.
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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Receipt photo produces immutable original + versioned parse run**  ‹maps: `ReceiptParseIT.uploadAndParse`, web `receipt-detail.spec`›
- **Given** Toby uploads a JPEG photo of a retail receipt
- **When** the parse job completes
- **Then** structured line items are created (header: merchant, date, total; per-line: description, qty, amount, currency) stored as `receipt_parse_runs` version 1
- **And** the original document (`document_id`) is **immutable** — the raw S3 object is never modified (F05 invariant).

**AC2 — Learned categorisation from confirmed history**  ‹maps: `LearnedSuggestionIT`, web `receipt-detail.spec` suggestion-chip›
- **Given** Toby previously confirmed "Drake's silk tie → Clothing/`bespoke`" on an earlier receipt
- **When** a new Drake's receipt arrives with a similar tie line item
- **Then** the line item shows `suggested_category=Clothing`, `suggested_tags=['bespoke']`, `suggestion_source=history`, with a high `suggestion_confidence`
- **And** the **suggestion chip** in the UI displays "history" as source, no manual re-entry needed.

**AC3 — Novel item routed to Claude at lower confidence**  ‹maps: `ColdStartSuggestionIT`›
- **Given** a line item for a merchant/description never seen before (no matching rule or history)
- **When** the categorisation pipeline runs
- **Then** the suggestion has `suggestion_source=claude`, `suggestion_confidence` below the auto-apply threshold, and the receipt enters `status=needs_review`
- **And** the low-confidence line is **highlighted** in the review UI for human confirmation.

**AC4 — Confirmation writes to memory; next retrieval hits history**  ‹maps: `MemoryWriteIT`, web `receipt-detail.spec` confirm›
- **Given** a line item in `status=suggested`
- **When** Lorna (or Toby) confirms its category/tags
- **Then** a `line_item_memory` row is written with the embedding, confirmed category and tags; the confirmation is audited
- **And** re-running the suggestion pipeline for a semantically similar item now returns `suggestion_source=history` with higher confidence.

**AC5 — Line item proposes grouped asset; human confirms**  ‹maps: `LineItemToAssetProposalIT`›  *(invariant: financial/asset creation proposed, never auto-committed)*
- **Given** a line item "6 crystal tumblers — £240"
- **When** the parse pipeline and agent process it
- **Then** the system **proposes** one grouped asset (quantity=6) — status `proposed`, not committed
- **And** Toby must explicitly confirm before the asset record is created in F04; no asset is written without confirmation.

**AC8 — Product-level historical spend ("how much on Coca-Cola")**  ‹maps: `ProductSpendAggregateIT`, web `advanced.spec` nl-product-spend›
- **Given** several confirmed receipts over a year whose lines include Coca-Cola (varied descriptions: "Coca Cola 330ml ×6", "Coke 1.5L")
- **When** Toby asks (NL/F32 or an insights filter) "how much did I spend on Coca-Cola this year?"
- **Then** all those lines resolve to the **same** `brand_norm`/`product_id` and the system returns the **summed spend** (FX-normalised, F37), not a fuzzy text guess
- **And** the figure is permission-filtered (a Manager's identical query is scoped/field-limited per F02 — no leak).

**AC6 — Re-parse creates new version without destroying prior work**  ‹maps: `ReparseVersioningIT`›
- **Given** receipt with version-1 parse run and some confirmed line items
- **When** Toby triggers a re-parse (e.g. after model upgrade)
- **Then** a new `receipt_parse_runs` row with `version=2` and `status=success` is created; the prior run is `status=superseded`
- **And** the original document is unchanged; all prior line-item confirmations are preserved and visible.

**AC7 — Staff cannot access receipts (negative)**  ‹maps: `ReceiptAuthzIT`›  *(invariant: Principal-private with Manager carve-out; no leak)*
- **Given** Marcia (Wardian Staff)
- **When** she requests `GET /api/receipts`
- **Then** she is **denied (403)** — no receipt data, no total amounts, no existence leaked
- **And** Lorna (Manager) can upload and confirm receipts; she sees confirmed amounts but not downstream asset valuations (stripped server-side, F02).

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
