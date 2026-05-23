# Feature F37 — Currencies & FX

| | |
|---|---|
| **Feature ID** | F37 |
| **Milestone** | M3 (with finance) |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F12 (transactions), F17 (expenses/budgets), F20 (valuation), F29 (rollups); resolves SPEC §19 #8 |
| **Spec references** | SPEC §13 (currency), §19 #8 (cross-currency rollups); user request (this turn) |

> **Decisions (revisitable):** **native amounts stay the truth** (minor units + ISO currency, never mutated); FX is an **overlay** for cross-currency *reporting/rollups* and an optional display currency. Capture the **rate-at-transaction-time** for historical accuracy; conversions are **explicit + labelled** ("≈ £X at 22 May rate") with a per-currency breakdown always available; **pluggable FX rate source** with daily snapshots. Approval **thresholds stay per-jurisdiction native** (£1,500 / S$2,500 — not converted). This **resolves §19 #8**.

## 1. Purpose & user value
You buy from anywhere — a watch in CHF, a guitar in USD, groceries in SGD, bills in GBP. Currencies become first-class: every amount keeps its true native value, but you can see a coherent household total / net-worth in your chosen currency, with honest, dated conversions and no silent FX fudging.

## 2. Roles & permissions
Resource `currency`/`fx` — system-fetched rates; **Principal** sets the **display currency** + active currencies; conversions inherit the viewer's field-level permissions (a converted total never reveals amounts they can't see).

## 3. Data model
`V__fx.sql`:
- **`currencies`** — `code (ISO 4217), symbol, decimals, active bool`. Registry (GBP, SGD, USD, EUR, CHF, …).
- **`fx_rates`** — `id, base text, quote text, rate numeric, as_of date, source text`. **Daily snapshots** + history; unique `(base,quote,as_of,source)`.
- **Rate-at-time**: financial rows (`bank_transactions`, `expenses`, asset acquisitions, valuations) optionally store `fx_rate_to_base numeric` + `fx_as_of` captured at creation, so historical conversions are accurate even as rates move.
- **Display preference**: generalise F01 `user_preferences.display_currency_mode` → `display_currency text` (any currency, or `native`).

## 4. API
`GET /api/currencies` · `GET /api/fx/rates?base=&quote=&as_of=` · `POST /api/fx/convert` (amount+from+to+date → converted + the rate used) · rollup endpoints (F29) accept a `?currency=` target. A scheduled **rate-fetch job** stores daily snapshots.

## 5. UI / screens & states
- The prototype's **Native / £-only** toggle generalises to a **display-currency selector** (Native · GBP · SGD · …).
- **Insights / Dashboard**: cross-currency totals (net worth, total spend) in the chosen currency, **labelled as a dated estimate**, with a **per-currency breakdown** expandable; native amounts always shown on individual records.
- **Finance**: transactions/expenses show native amount (+ optional "≈ display-currency" hint).
- States: native (default), converted (with rate/date), missing-rate (fallback + flag).

## 6. Business rules & validation
- **Native is truth**: amounts never mutated; conversions are computed, never stored as the value.
- **Rate selection**: historical figures convert at the **rate-at-time** (transaction date); current/aggregate views may use latest or as-of, **always labelled**.
- **Rollups**: cross-currency totals require a target currency + a stated rate basis; per-currency breakdowns remain primary (no silent blending).
- **Thresholds/budgets stay native per jurisdiction** (approval £1,500 / S$2,500; budgets per property currency) — not FX-converted.
- **Rounding** on conversion is display-only; never feeds back into native/ledger.
- **Pluggable source**: an `FxRateSource` adapter (e.g. ECB reference rates / a free FX API); daily snapshots; tolerate gaps (nearest prior rate).

## 7. Integrations / external systems
- **FX rate provider** (SETUP — to choose: ECB reference rates [free, EUR-based], exchangerate.host/open APIs, or a commercial feed); daily fetch job; secrets in Secrets Manager.
- F12 (transaction currency + rate-at-time), F17 (expenses/budgets), F20 (valuation currencies), F29 (rollups), F18 (ledger stays per-currency — F37 does not convert postings), F34 (optional `fx.rates_updated` event).

## 8. Edge cases
Missing rate for a date (nearest-prior + flag); exotic/inactive currency; provider downtime (use last snapshot); rate revision; very old historical conversion; rounding drift across many conversions; net-worth across 5 currencies (breakdown + estimate); base-currency choice (default GBP).

## 9. Acceptance criteria
- **AC1** A USD guitar purchase keeps its native USD value; its acquisition stores the USD→GBP rate-at-time.
- **AC2** Inventory value / net worth renders in the chosen display currency, **labelled as a dated estimate**, with a per-currency breakdown.
- **AC3** Switching display currency reconverts views; individual records still show native.
- **AC4** Approval thresholds compare in **native** per jurisdiction (no FX); budgets stay per-property currency.
- **AC5** A missing rate falls back to the nearest prior snapshot and is flagged.
- **AC6** A converted total never reveals amounts the viewer can't see (field-RBAC honoured).

## 10. Test plan
Backend (weaver+PG; FX provider mocked): rate snapshot fetch + storage; rate-at-time capture; conversion (historical vs latest) + labelling; rollup per target currency + per-currency breakdown; threshold-stays-native; missing-rate fallback; permission-safe conversions. Web: Vitest currency selector + labelled estimates; Playwright multi-currency net-worth.

## 11. Observability & audit
Audit: display-currency + active-currency changes. Metrics: rate-fetch success/lag, currencies in use, conversion volume, missing-rate incidents.

## 12. Open questions
1. **FX provider** (ECB free vs commercial) — a SETUP decision. 2. **Base currency** (GBP default?). 3. Latest-vs-as-of default for aggregate views. 4. Whether to ever show converted ledger figures (lean: no — ledger stays per-currency).
