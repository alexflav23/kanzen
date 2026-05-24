# Feature F37 — Currencies & FX

| | |
|---|---|
| **Feature ID** | F37 |
| **Milestone** | M3 — **foundational**, lands **with F12** (bank ingestion) |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F12 (transactions), F17 (expenses/budgets), F20 (valuation), F29 (rollups); resolves SPEC §19 #8 |
| **Spec references** | SPEC §13 (currency), §19 #8 (cross-currency rollups); user request (this turn) |

> **Decisions (revisitable):** a **foundational** capability. **Native amounts stay the truth** (minor units + ISO currency, never mutated); a single **reporting/base currency** (default **GBP**, configurable) lets everything roll up coherently. The core requirement: **every transaction converts at the daily FX rate on its own transaction date** — so unified-currency reporting is **historically accurate**, not re-stated at today's rate. The **rate-at-date is captured at ingestion** (with F12) and stored permanently. Daily-granularity rates; weekends/holidays → nearest-prior. Conversions are **explicit + labelled** ("≈ £X at 22 May rate") with a per-currency breakdown always available. **Pluggable provider** (default **ECB daily reference rates** — free; triangulate non-EUR pairs via EUR). Approval **thresholds stay per-jurisdiction native** (£1,500 / S$2,500 — not converted). This **resolves §19 #8**.

> **Foundational timing:** the base currency, the FX-rate source, the daily-snapshot job, and rate-at-date capture stand up **with F12** (bank ingestion) — not bolted on later — and the snapshot job **backfills history** so older transactions can be converted accurately too.

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
- **Rate selection**: historical figures convert at the **rate on the transaction's own date** (the captured `fx_rate_to_base` / the `fx_rates` snapshot for `booked_at`); current/aggregate views may use latest or as-of, **always labelled**. **GoCardless supplies the transaction's native amount, currency and date — not a rate to our base**; the FX layer supplies that from stored daily snapshots, captured at ingestion so it's never lost or re-stated.
- **Rollups**: cross-currency totals require a target currency + a stated rate basis; per-currency breakdowns remain primary (no silent blending).
- **Thresholds/budgets stay native per jurisdiction** (approval £1,500 / S$2,500; budgets per property currency) — not FX-converted.
- **Rounding** on conversion is display-only; never feeds back into native/ledger.
- **Pluggable source**: an `FxRateSource` adapter (e.g. ECB reference rates / a free FX API); daily snapshots; tolerate gaps (nearest prior rate).

## 7. Integrations / external systems
- **FX rate provider** (SETUP — to choose: ECB reference rates [free, EUR-based], exchangerate.host/open APIs, or a commercial feed); daily fetch job; secrets in Secrets Manager.
- F12 (transaction currency + rate-at-time), F17 (expenses/budgets), F20 (valuation currencies), F29 (rollups), F18 (ledger stays per-currency — F37 does not convert postings), F34 (optional `fx.rates_updated` event).

## 8. Edge cases
Missing rate for a date (nearest-prior + flag); exotic/inactive currency; provider downtime (use last snapshot); rate revision; very old historical conversion; rounding drift across many conversions; net-worth across 5 currencies (breakdown + estimate); base-currency choice (default GBP).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Native amount preserved; rate-at-date captured at ingestion**  ‹maps: `FxRateAtIngestionIT`, web `transactions.spec` native-amount›
- **Given** a USD guitar purchase ingested from GoCardless on a known date
- **When** the transaction is stored
- **Then** `amount_minor` and `currency=USD` are the authoritative values (never mutated); `fx_rate_to_base` (USD→GBP) and `fx_as_of` are captured from the `fx_rates` snapshot for that `booked_at` date
- **And** re-running a later sync does **not** overwrite `fx_rate_to_base` with today's rate — the historical rate is preserved.

**AC2 — Inventory value renders in chosen display currency, labelled as a dated estimate**  ‹maps: `FxRollupLabelledIT`, web `insights.spec` display-currency›
- **Given** assets and transactions in USD, SGD, and CHF
- **When** Toby selects **GBP** as his display currency in Insights
- **Then** the inventory value / net-worth tile shows the GBP equivalent **labelled as a dated estimate** (e.g. "≈ £X at 22 May rate") alongside a **per-currency breakdown** (USD / SGD / CHF subtotals)
- **And** the per-currency breakdown is expandable and shows native amounts as the primary truth.

**AC3 — Switching display currency reconverts views; individual records show native**  ‹maps: `FxDisplayCurrencySwitchIT`, web `insights.spec` toggle›
- **Given** Toby is viewing Insights in GBP display mode
- **When** he switches display currency to SGD
- **Then** all aggregates reconvert using stored `fx_rate_to_base` values (not today's live rate); the "as of" label updates to reflect the stated basis
- **And** individual transaction and expense records continue to show their **native** currency first; the display-currency hint is secondary.

**AC4 — Approval thresholds and budgets stay per-jurisdiction native; no FX conversion**  ‹maps: `ThresholdNativeFxIT`›  *(invariant: thresholds compare in native per jurisdiction — F17)*
- **Given** Wardian threshold £1,500 and Singapore threshold S$2,500
- **When** a S$3,000 Singapore expense and a £1,200 Wardian expense are submitted
- **Then** the S$3,000 expense routes to approval (S$3,000 > S$2,500 native); the £1,200 expense auto-approves
- **And** no FX conversion is applied at any point in the threshold comparison; budgets remain in their property's native currency.

**AC5 — Missing rate falls back to nearest prior snapshot and is flagged**  ‹maps: `FxMissingRateFallbackIT`›
- **Given** a weekend date or a gap in the rate history for a currency pair
- **When** a conversion for that date is requested
- **Then** the system uses the **nearest prior** `fx_rates` snapshot (not today's rate) and the response / UI flags the fallback clearly (e.g. "using 21 May rate — weekend")
- **And** no conversion silently uses a stale or incorrect rate without surfacing it.

**AC6 — Converted total never leaks amounts the viewer cannot see**  ‹maps: `FxPermissionSafeConversionIT`›  *(invariant: field-RBAC honoured; no leak via totals — F02)*
- **Given** assets with valuations that Lorna (Manager) cannot see
- **When** Lorna requests `GET /api/insights/inventory-value?currency=GBP`
- **Then** the converted total **omits** valuation-derived figures; the GBP rollup reflects only amounts within her permission scope
- **And** the backend test asserts that the Manager-scoped converted total differs from Toby's and does not disclose any valuation through arithmetic inference.

## 10. Test plan
Backend (weaver+PG; FX provider mocked): rate snapshot fetch + storage; rate-at-time capture; conversion (historical vs latest) + labelling; rollup per target currency + per-currency breakdown; threshold-stays-native; missing-rate fallback; permission-safe conversions. Web: Vitest currency selector + labelled estimates; Playwright multi-currency net-worth.

## 11. Observability & audit
Audit: display-currency + active-currency changes. Metrics: rate-fetch success/lag, currencies in use, conversion volume, missing-rate incidents.

## 12. Open questions
1. **FX provider** (ECB free vs commercial) — a SETUP decision. 2. **Base currency** (GBP default?). 3. Latest-vs-as-of default for aggregate views. 4. Whether to ever show converted ledger figures (lean: no — ledger stays per-currency).
