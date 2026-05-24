# Feature F36 — Predictive replenishment (consumption analytics)

| | |
|---|---|
| **Feature ID** | F36 |
| **Milestone** | M7 (analytics) |
| **Domain** | Operations / Insights |
| **Status** | ✅ spec complete |
| **Depends on** | F35 (products/stock), F12/F13/F14 (purchase history), F08 (lists), F34 (events), F29 (insights) |
| **Spec references** | user request (this turn); builds on F35 + the transaction/line-item history |

> **Decisions (revisitable):** learn each consumable's **purchase cadence** from history (transactions/receipts/line-items + product stock events + list orders), **predict the next run-out**, and **proactively suggest a reorder** before you run dry. v1 = explainable **interval statistics** (median/EWMA between purchases), not heavy ML; ML/seasonality later. Suggestions are **proposed** (human-approves), never auto-ordered (unless a staple is opted in).

## 1. Purpose & user value
"You buy eggs about every 6 days — you'll be out in 2." The household stops running out of routine things: Kanzen watches what's actually purchased, learns the rhythm, and nudges a reorder (pre-filled with the preferred spec + buy link, F35) at the right moment — turning reactive shopping into quiet, predictive supply.

## 2. Roles & permissions
Resource `product`/insights (property-scoped, F02): **Principal/Manager** see forecasts + manage auto-reorder opt-ins; **Staff** see their property's "due soon"; spend-derived inputs respect field-level RBAC (a Staff forecast needn't expose prices).

## 3. Data model
`V__replenishment.sql` (mostly derived/materialised):
- **`product_purchases`** — links a purchase to a product: `id, product_id → products, source_type ('line_item'|'transaction'|'list_order'|'stock_event'), source_id, purchased_at, qty numeric null, amount_minor null, currency`. Populated by matching line items/transactions to products (reuse F13 learned categorisation/embeddings + explicit links).
- **`product_consumption`** (materialised) — `product_id, avg_interval_days numeric, interval_method ('median'|'ewma'), last_purchased_at, predicted_next_at, confidence numeric, sample_size int, computed_at`.

## 4. API
`GET /api/products/:id/consumption` (cadence + prediction) · `GET /api/replenishment/due?property=&within=` (predicted-due list) · `POST /api/products/:id/auto-reorder` (opt-in/threshold) · a scheduled **forecast + due-scan job** (emits `product.replenishment_due` via F34 → Lists suggestion).

## 5. UI / screens & states
- **Products view** (F35): each product shows **cadence** ("~every 6 days") + **predicted next** + a confidence indicator.
- **Inbox / Dashboard**: "due soon" reorder suggestions → one-tap into a Lists buy request (F35/F08), pre-filled with preferred spec + buy link.
- **Insights** (F29): consumption/replenishment reporting (most-bought, cadence, spend rate per consumable).
- States: forecasting, confident, low-confidence (sparse history → suggest, don't auto), seasonal/irregular (flagged).

## 6. Business rules & validation
- **Cadence** = median/EWMA of intervals between matched purchases (robust to outliers); `predicted_next = last_purchased + avg_interval`; **due** when `predicted_next - lead ≤ today` → suggest.
- **Confidence** scales with `sample_size` + interval variance; low confidence → suggest but don't auto-order.
- **Purchase→product matching** reuses F13's merchant/line-item learning (+ explicit links); confirmations improve it.
- **Proposed, not automatic** by default (human approves the reorder); a per-product **auto-reorder opt-in** exists for true staples (still creates an approvable list item unless explicitly auto).
- Multi-currency spend handled via F37 (native + optional conversion for "spend rate").

## 7. Integrations
F35 (products/stock), F13/F12/F14 (purchase history + matching), F08 (reorder → list), F34 (`replenishment_due` event → notification/list), F29 (reporting), F37 (spend in mixed currencies).

## 8. Edge cases
Sparse/no history (cold start → no prediction, manual); irregular/seasonal items (flag, widen interval); one-off vs recurring; bulk buys (qty-aware); mis-matched purchase (correctable); product renamed/merged; multi-property cadence; price changes.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Cadence computed and displayed after purchase history builds**  ‹maps: `ReplenishmentCadenceIT`, web `products.spec` cadence›
- **Given** several egg purchases have been matched to the "Eggs" product (via F13/F12 line items)
- **When** the forecast job runs
- **Then** the product shows "~every N days" (median/EWMA of intervals), a `predicted_next_at` date, and a confidence indicator
- **And** the `product_consumption` materialised row records `avg_interval_days`, `interval_method`, `sample_size`, and `computed_at`.

**AC2 — Reorder suggestion appears as predicted-next approaches and pre-fills a list item**  ‹maps: `ReplenishmentDueScanIT`, web `replenishment.spec` due-suggestions, mobile `replenishment_test.dart`›
- **Given** a product whose `predicted_next - lead_days ≤ today`
- **When** the due-scan job emits `product.replenishment_due` (F34)
- **Then** a reorder suggestion appears in the **Inbox/Dashboard** with a one-tap action
- **And** tapping it pre-fills a Lists buy request (preferred spec + buy URL from F35) — the suggestion is **proposed**, not auto-approved.

**AC3 — Replenishment suggestion is proposed, never auto-committed (invariant)**  ‹maps: `ReplenishmentNoAutoCommitIT`›  *(invariant: agent/automation never auto-commits)*
- **Given** any product with replenishment enabled (including ones opted into auto-reorder)
- **When** the due-scan triggers a suggestion
- **Then** the resulting list item has status `needs_approval`, visible to Principal/Manager
- **And** **no order is placed and no task is created** until a human explicitly approves — the invariant holds regardless of opt-in level.

**AC4 — Low-confidence products suggest cautiously and never auto-order**  ‹maps: `ReplenishmentLowConfidenceIT`›
- **Given** a product with only 1–2 purchases (sparse history, low `confidence`)
- **When** the forecast job runs
- **Then** a `predicted_next_at` may be computed but the confidence indicator is shown as low
- **And** no automatic suggestion is emitted until confidence exceeds the configured threshold; the product is flagged as "sparse history — suggest manually".

**AC5 — Forecasts are explainable: intervals shown to Principal/Manager**  ‹maps: `ReplenishmentExplainabilityIT`, web `replenishment.spec` forecast-detail›
- **Given** a product with a computed cadence
- **When** Toby or Lorna opens the product detail or the consumption API
- **Then** the forecast shows the underlying intervals (purchase dates + gaps) that produced `avg_interval_days`
- **And** the method (`median` or `ewma`) is displayed so the forecast is auditable, not a black box.

**AC6 — Staff see "due soon" but not spend-derived prices (negative)**  ‹maps: `ReplenishmentScopeIT`, mobile `replenishment_test.dart`›
- **Given** Marcia (Wardian-Staff)
- **When** she views replenishment suggestions for Wardian
- **Then** she sees "due soon" items for her property but **price/spend data is stripped** (field-level RBAC)
- **And** a direct request for Singapore replenishment data returns **403/404** — property scope enforced.

**AC7 — Purchase-to-product matching is correctable and improves forecast**  ‹maps: `ReplenishmentMatchingIT`›
- **Given** a purchase transaction was incorrectly matched to "Eggs" (mis-classification)
- **When** Toby corrects the match
- **Then** the `product_purchases` link is updated, the `product_consumption` materialised view is recomputed, and the forecast reflects the corrected history
- **And** the correction is audited; the updated intervals are visible in the explainability view.

## 10. Test plan
Backend (weaver+PG): interval stats (median/EWMA) + prediction; due-scan + event emission; purchase→product matching; confidence/sparse handling; multi-property. Web: Vitest cadence display + due suggestions; Playwright eggs cadence → due → reorder.

## 11. Observability & audit
Audit: auto-reorder opt-ins, suggestion → order conversions. Metrics: forecast accuracy (predicted vs actual purchase), suggestion acceptance, stock-out incidents avoided, most-replenished products.

## 12. Open questions
1. Forecasting method (interval stats v1; Croston/seasonal/ML later). 2. Confidence threshold for suggesting vs staying quiet. 3. Purchase→product matching aggressiveness (reuse F13 learning). 4. Whether any items truly auto-order (vs always approvable).
