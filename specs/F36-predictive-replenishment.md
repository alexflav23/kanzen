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

## 9. Acceptance criteria
- **AC1** After several egg purchases, the product shows "~every N days" + a predicted-next date with a confidence.
- **AC2** As predicted-next approaches, a reorder suggestion appears (Inbox/Dashboard) and pre-fills a Lists buy request (spec + buy link).
- **AC3** Low-confidence (sparse) products suggest cautiously and never auto-order.
- **AC4** A staple opted into auto-reorder still produces an approvable order (unless explicitly fully-auto).
- **AC5** Forecasts are explainable (show the intervals they're based on).

## 10. Test plan
Backend (weaver+PG): interval stats (median/EWMA) + prediction; due-scan + event emission; purchase→product matching; confidence/sparse handling; multi-property. Web: Vitest cadence display + due suggestions; Playwright eggs cadence → due → reorder.

## 11. Observability & audit
Audit: auto-reorder opt-ins, suggestion → order conversions. Metrics: forecast accuracy (predicted vs actual purchase), suggestion acceptance, stock-out incidents avoided, most-replenished products.

## 12. Open questions
1. Forecasting method (interval stats v1; Croston/seasonal/ML later). 2. Confidence threshold for suggesting vs staying quiet. 3. Purchase→product matching aggressiveness (reuse F13 learning). 4. Whether any items truly auto-order (vs always approvable).
