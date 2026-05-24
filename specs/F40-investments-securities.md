# Feature F40 — Investments & securities

| | |
|---|---|
| **Feature ID** | F40 |
| **Milestone** | Wave G (Private Wealth) |
| **Domain** | Private Wealth |
| **Status** | spec complete |
| **Depends on** | F39 (accounting core), F42 (entities), F37 (FX); feeds F41/F43, F38 |
| **Spec references** | GnuCash `gnc-commodity` / `gnc-pricedb` / `gnc-lot`; the implementation plan |

> **Decisions:** full investment accounting — securities/commodities including illiquid/private holdings; a time-series price database (live + manual); holdings managed as typed **security accounts** in the F39 chart of accounts, entity-scoped (F42); cost-basis lot accounting (buy creates a lot; sell closes lots via FIFO or specific-identification → realised capital gains; unrealised gain from current price); dividends/distributions; corporate actions (stock splits, mergers, spin-offs) adjusting lots and holdings. Portfolio view: holdings table, allocation (by asset class / sector / currency / entity), performance (TWR/IRR), gains. **Invariant: Kanzen records investments, never executes trades** (no brokerage order, no PIS); the TigerBeetle ledger (F18) is hidden in the UI; investments are **Principal-private**. Money always integer minor units + ISO currency; quantity of shares as `numeric` (fractional shares); FX at transaction-date rate via F37.

---

## 1. Purpose & user value

A UHNWI household holds far more than property and cash: a brokerage account of equities and ETFs, a bond ladder, some private equity stakes, crypto, and a watch collection investment fund — all in multiple currencies, spread across personal and trust accounts. Today those live in a spreadsheet (at best).

F40 brings them inside Kanzen: every security is registered with identifiers and a live or manual price, every buy and sell lands as a lot with a cost basis, every dividend is recorded, and the portfolio screen answers "what do I own, what did it cost, what is it worth, and what has it returned?" — broken down by asset class, entity, and currency, with correct realised and unrealised capital gains for F38 tax reporting. The TigerBeetle ledger (F18) gets the matching accounting entries; all of it feeds the consolidated net-worth picture in F41 and the financial statements in F43.

## 2. Roles & permissions

Resources `securities`, `security_prices`, `investment_lots`, `lot_closures`, `distributions`, `corporate_actions` — **Principal-private** (F02):

| Actor | Permission |
|---|---|
| **Toby (Principal)** | `admin` — full read/write across all entities |
| **Lorna (Manager)** | `none` — investments are Principal-private; no read, no totals, no portfolio aggregates |
| **Marcia / Siti (Staff)** | `none` |
| **The Agent** | proposes transactions (dividend email → proposed distribution, brokerage statement → proposed lots) via the same Authorizer path; **never auto-commits** a lot, closure, or distribution (F27) |

Default-deny. A Manager must not learn of the existence of a holding, a valuation, or a gain through any response field or aggregate total.

## 3. Data model

`V__investments.sql` (depends on F39 `accounts`, F42 `entities`):

### 3.1 Securities / commodities

```sql
securities (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  isin            text,                              -- ISO 6166
  ticker          text,                              -- exchange-specific
  name            text        not null,
  asset_class     text        not null,              -- 'equity'|'bond'|'etf'|'fund'|'crypto'|'private'|'other'
  sector          text,
  currency        text        not null,              -- ISO 4217 trading currency
  exchange        text,
  quote_source    text        not null default 'manual',  -- 'manual'|'yahoo'|'alpha_vantage'|'openfigi'|…
  is_illiquid     bool        not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
```

### 3.2 Price database

```sql
security_prices (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  security_id     uuid        not null references securities(id),
  as_of           date        not null,
  price_minor     bigint      not null,              -- integer minor units
  currency        text        not null,              -- ISO 4217 (matches securities.currency)
  source          text        not null,              -- 'live'|'manual'|'import'
  is_manual       bool        not null default false,
  staleness_days  int,                               -- days since prior price (computed / denormalised)
  created_at      timestamptz not null default now(),
  unique (security_id, as_of, source)
);
```

### 3.3 Investment lots (cost-basis unit)

```sql
investment_lots (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  entity_id       uuid        not null references entities(id),    -- F42
  account_id      uuid        not null references accounts(id),    -- F39 security account
  security_id     uuid        not null references securities(id),
  open_date       date        not null,
  qty             numeric(28,10) not null,           -- fractional shares allowed
  cost_basis_minor bigint     not null,              -- total cost in lot currency, integer minor units
  cost_basis_per_unit_minor bigint not null,         -- cost_basis_minor / qty (stored for convenience)
  currency        text        not null,              -- ISO 4217
  fx_rate_to_base numeric,                           -- F37 rate at open_date
  fx_as_of        date,
  status          text        not null default 'open',  -- 'open'|'closed'|'partial'
  notes           text,
  source_type     text,                              -- 'manual'|'import'|'agent_proposed'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
```

### 3.4 Lot closures (sell events)

```sql
lot_closures (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  lot_id          uuid        not null references investment_lots(id),
  close_date      date        not null,
  qty             numeric(28,10) not null,           -- qty sold from this lot
  proceeds_minor  bigint      not null,              -- integer minor units
  currency        text        not null,
  fx_rate_to_base numeric,                           -- F37 rate at close_date
  fx_as_of        date,
  gain_minor      bigint      not null,              -- proceeds_minor − (qty × cost_basis_per_unit_minor)
  term            text        not null,              -- 'short'|'long' (≥ 365 days → long)
  cost_basis_method text      not null default 'fifo',  -- 'fifo'|'specific_id'
  created_at      timestamptz not null default now()
);
```

### 3.5 Distributions (dividends / interest / return of capital)

```sql
distributions (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  entity_id       uuid        not null references entities(id),
  security_id     uuid        not null references securities(id),
  account_id      uuid        not null references accounts(id),   -- F39 income account
  distribution_date date      not null,
  kind            text        not null,             -- 'dividend'|'interest'|'return_of_capital'|'drip'
  amount_minor    bigint      not null,             -- integer minor units
  currency        text        not null,
  qty_reinvested  numeric(28,10),                   -- for DRIP: shares received
  lot_id          uuid references investment_lots(id),  -- lot opened by DRIP
  fx_rate_to_base numeric,
  fx_as_of        date,
  status          text        not null default 'proposed',  -- 'proposed'|'confirmed'|'voided'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 3.6 Corporate actions

```sql
corporate_actions (
  id              uuid        primary key default gen_random_uuid(),
  owner_id        uuid        not null references users(id),
  security_id     uuid        not null references securities(id),
  action_date     date        not null,
  kind            text        not null,             -- 'split'|'reverse_split'|'merger'|'spinoff'|'name_change'
  ratio_numerator   numeric,                        -- split: new shares
  ratio_denominator numeric,                        -- split: old shares
  new_security_id uuid references securities(id),  -- merger/spinoff
  notes           text,
  status          text        not null default 'proposed',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 3.7 Ledger integration (F18)

Corporate-action lot adjustments, buy/sell lot opens/closures, and confirmed distributions each produce a `ledger_posting_group` (F18) with balanced TB splits:
- **Buy**: debit security account (asset), credit cash account (asset).
- **Sell**: debit cash account (asset), credit security account (asset); realised-gain split to income or loss account.
- **Dividend**: debit cash account, credit dividend-income account.
- **DRIP**: debit security account, credit dividend-income account.
- **Corporate action (split)**: quantity adjustment; cost basis per unit recalculated; no TB posting needed (no value moves).
- **Corporate action (merger/spinoff)**: old lot closed at cost → new lot opened at carryover cost basis; TB posts the transfer.

All amounts integer minor units; postings stay in **native** currency; F37 supplies the base-currency rate; the ledger is hidden in the UI.

All writes to `investment_lots`, `lot_closures`, `distributions`, `corporate_actions` are audited.

## 4. API (Tapir endpoints)

All endpoints under `/api/investments`; all Principal-only.

### Securities

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/securities` | list; filter by asset_class, currency, is_illiquid |
| `POST` | `/api/investments/securities` | create (proposes if from agent) |
| `GET` | `/api/investments/securities/:id` | detail + current price + unrealised gain |
| `PATCH` | `/api/investments/securities/:id` | update metadata, quote_source |
| `DELETE` | `/api/investments/securities/:id` | soft delete |

### Price database

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/prices/:securityId` | time-series (since, limit) |
| `POST` | `/api/investments/prices/:securityId` | manual price entry |
| `GET` | `/api/investments/prices/:securityId/latest` | latest price + staleness flag |
| `POST` | `/api/investments/prices/refresh` | trigger live-quote fetch for all active securities |

### Lots

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/lots` | list; filter by entity, security, status |
| `POST` | `/api/investments/lots` | open a lot (buy event) |
| `GET` | `/api/investments/lots/:id` | lot detail + closures |
| `POST` | `/api/investments/lots/:id/close` | close/partial-close (sell); body: `{qty, proceeds_minor, currency, close_date, method}` |

### Distributions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/distributions` | list; filter by entity, security, kind, date range |
| `POST` | `/api/investments/distributions` | propose distribution |
| `PATCH` | `/api/investments/distributions/:id` | confirm or void |

### Corporate actions

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/corporate-actions` | list |
| `POST` | `/api/investments/corporate-actions` | propose action |
| `POST` | `/api/investments/corporate-actions/:id/apply` | apply confirmed action (adjusts lots) |

### Portfolio

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/investments/portfolio` | holdings table: security, qty, cost basis, current value, unrealised gain/%, FX-normalised; filter by entity |
| `GET` | `/api/investments/portfolio/allocation` | by asset_class / sector / currency / entity; `?currency=` for FX rollup |
| `GET` | `/api/investments/portfolio/performance` | TWR + IRR per holding and total; `?from=&to=` |
| `GET` | `/api/investments/portfolio/gains` | realised + unrealised gains; filter year for F38 capital-gains feed |

There is **no trade-execution endpoint** — `POST /api/investments/lots` records an already-executed buy; there is no order, submit, or broker-instruction resource.

## 5. UI / screens & states

### Investments screen (under Private Wealth / Finance)

**Holdings tab** (default):
- Table: Security name | Ticker/ISIN | Asset class | Qty | Cost basis | Current price | Current value | Unrealised gain (£ / %) | Currency.
- Row actions: view detail, edit, add distribution.
- FX rollup selector (Native / GBP / SGD / …) — labelled as dated estimate (F37).
- Sort by: security name, value, gain %, asset class.

**Allocation tab**:
- Treemap / stacked bar by asset class (default) — switch: sector / currency / entity.
- Per-segment: % of portfolio, value.

**Performance tab**:
- Per-holding TWR (time-weighted return) + IRR; total portfolio TWR/IRR.
- Period selector.

**Gains tab**:
- Realised gains (year-to-date / full year): short-term / long-term; feeds F38 capital-gains.
- Unrealised gains table.

**Securities management** (side panel / sub-route):
- List: name, type, quote source, last price, staleness indicator.
- Create / edit security; toggle illiquid (switches to manual entry only).
- Price history chart + manual price entry.

**Lot detail** (modal):
- Buy date, qty, cost basis, closures, corporate actions applied.

**States**: loading, empty (no holdings), error, **forbidden** (non-Principal → clear 403 message, no portfolio totals visible), illiquid-price-stale warning, missing-price warning (using nearest-prior flag), proposed-pending indicator (agent-proposed lots/distributions awaiting confirmation in Triage).

**Design language**: warm-paper light/dark, indigo accent, tabular money, grouped nav — consistent with SPEC §16 / App. E. The 完 mark on confirmed holdings.

## 6. Business rules & validation

### Cost basis & lot accounting

- **Every buy opens one lot**: `qty`, `cost_basis_minor` (total), `cost_basis_per_unit_minor` = `cost_basis_minor / qty`.
- **Sell closes lots** in the chosen cost-basis method:
  - **FIFO** (default): oldest open lots consumed first; partial lots produce a partial closure + remainder.
  - **Specific identification**: caller specifies the `lot_id`(s) and qty; system validates `qty ≤ lot.qty remaining`.
- **Realised gain** = `proceeds_minor − (qty_sold × cost_basis_per_unit_minor)` in the lot's currency.
- **Gain term**: short-term if `close_date − open_date < 365 days`; long-term otherwise; stored on `lot_closures.term`.
- **Unrealised gain** (derived, not stored): `(current_price − cost_basis_per_unit) × qty_open` per security.

### Price database

- **Live sources** (see §7) refresh on a scheduled job; each run upserts into `security_prices` with `source='live'`.
- **Manual entry** (`is_manual=true`) for illiquid holdings — always required if `is_illiquid=true`.
- **Latest price rule**: the most recent `security_prices` row for `(security_id, as_of ≤ today)` in `as_of DESC` order.
- **Missing price**: fall back to the nearest prior row; flag `staleness_days`; surface warning in UI if > 30 days for liquid, > 365 days for illiquid.
- **Valuation uses the price on `as_of = today`** (or nearest prior); the date is always shown.

### FX

- `cost_basis_minor` and `proceeds_minor` are in the lot's **native currency** (truth); `fx_rate_to_base` (from F37 at the transaction date) is captured at lot-open and lot-close for historical reporting.
- Portfolio rollups in a non-native display currency use stored `fx_rate_to_base` or the nearest F37 snapshot for each record — always labelled as an estimate with the rate date.
- The base-currency gain/loss for F38/F43 converts at **transaction-date rate**, not today's rate.

### Corporate actions

- **Stock split** (`ratio_num:ratio_denom`): multiply all open-lot `qty` for the security by `ratio_num/ratio_denom`; set `cost_basis_per_unit_minor = cost_basis_minor / new_qty`. No TB posting (qty adjustment only — no value transfer).
- **Merger / spin-off**: old lots are closed at their original cost basis (`gain_minor = 0`, note `kind=merger`); new lots are opened on the successor security carrying the carryover cost basis. TB posts the inter-account transfer.
- **Name / ticker change**: security metadata update only; lots unchanged.

### DRIP (dividend reinvestment)

- Record the distribution with `kind='drip'`, `qty_reinvested`, and `amount_minor` (the notional cash value).
- Simultaneously open a new lot for the reinvested shares (`source_type='drip'`).
- TB: debit security account, credit dividend-income account.

### Financial / agent invariants

- **No trade execution**: there is no order, instruction, or brokerage-integration resource. `POST /api/investments/lots` records a past buy; it is not a trade instruction.
- **Financial creation proposed, not committed**: lots, closures, distributions and corporate-action applications proposed by the Agent go to Triage (F26/F27) before any DB write is committed.
- **Ledger hidden**: no TB account IDs, transfer IDs, or raw postings appear in any portfolio API response or screen.
- **Principal-private**: no portfolio total, allocation percentage, or gain figure is returned to any non-Principal actor — server-side, not just UI-hidden.

## 7. Integrations / external systems

### Market data / quotes provider (SETUP — Finance::Quote-style)

A pluggable `QuoteSource` adapter (sealed trait; one implementation per source) fetches live prices for liquid securities. Options to configure in SETUP:

| Option | Notes |
|---|---|
| **Yahoo Finance** (unofficial API / `finance-quote` library) | free; wide coverage; unofficial/fragile |
| **Alpha Vantage** (free tier: 25 req/day) | API key required; broad equity/ETF/crypto coverage |
| **Tiingo** (free tier: 500 req/day) | quality daily OHLCV; stocks, funds |
| **Open Exchange Rates / Twelve Data** | alternative; usage-limited free tiers |
| **Manual only** | default for `is_illiquid=true`; always available as fallback |

The scheduled fetch job runs daily (configurable via config, not hard-coded); runs after the F37 FX rate snapshot job; secrets (API key) in Secrets Manager; config (provider choice, fetch interval) in SSM. Provider failures → log + alert + fall back to last cached price, never blank the holding.

### FX (F37)

`fx_rate_to_base` captured at lot open/close/distribution date from `fx_rates` snapshots. Portfolio rollups delegate to F37's `POST /api/fx/convert` or direct DB lookup. Nearest-prior fallback applies.

### TigerBeetle (F18)

Buy, sell, dividend, DRIP, and merger/spinoff events produce `ledger_posting_groups` via the shared posting pipeline. Lot closures and distributions are only fully committed once the TB posting succeeds (or is queued); the domain row status stays `proposed` until the posting group is confirmed. Idempotency key: `(source_type, source_id='lot_closure.id'|'distribution.id', kind)`.

### Bedrock (F25 — optional)

The email agent (F25) can parse a brokerage statement (PDF/email) using Claude multimodal, extract proposed lots/distributions/corporate actions, and surface them in Triage (F26) for Toby to confirm. The Bedrock call is optional (feature-flagged); parsing failures → manual entry prompt, never silent data.

## 8. Edge cases

- **Cost-basis method switch** (FIFO → specific-id mid-history): prior closures are immutable; new closures use the new method. The API validates that `lot_id` supplied in specific-id mode belongs to the same security and entity.
- **Partial lot sale**: `lot_closures.qty < investment_lots.qty` → lot status becomes `partial`; the remainder is still open; the cost basis per unit is unchanged.
- **Stock split adjusts existing open lots**: all open lots for the security are adjusted atomically; a partial lot is adjusted on its remaining qty only; closures prior to the split date are untouched.
- **Multi-currency security** (e.g. London-listed security trading in GBX — pence — but reported in GBP): `security.currency` = 'GBX'; `security_prices.price_minor` in GBX; the portfolio screen converts to GBP for display (× 0.01).
- **Illiquid holding — manual valuation + staleness**: if `is_illiquid=true` and no price within 365 days, the portfolio row shows a `price_stale` warning; the holding is still included at the most-recent manual price; it does not silently disappear.
- **Missing price (nearest-prior fallback)**: if no `security_prices` row exists for a date, the query walks backward to the nearest prior row; if no row exists at all, the holding shows `price=null` with a `no_price` flag; unrealised gain is `null`, not zero.
- **Dividend reinvestment (DRIP)**: a single confirmed DRIP event creates both a distribution record and a new lot in one transaction; if the lot-open fails, the distribution is not committed (same DB transaction).
- **Agent-proposed lot from brokerage statement**: the agent extracts `{security, qty, cost_basis, open_date}` and posts a proposed lot to Triage; the user can edit all fields before confirming; the agent's extracted values are stored as `source_type='agent_proposed'` and are auditable.
- **Zero-cost-basis holding** (gifted shares, stock compensation): `cost_basis_minor = 0` is valid; unrealised gain = full current value; realised gain on sale = full proceeds.
- **Corporate action on a partially-closed lot**: only the open/remaining qty is adjusted; the closed-closure rows are immutable.
- **Realised loss** (`gain_minor < 0`): negative gain is valid; fed to F38 as an offsetting capital loss.

## 9. Acceptance scenarios (UAT)

Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Buy opens a lot with correct cost basis**  ‹maps: `LotOpenIT` (weaver+TC), `InvestmentLotSpec` (FreeSpec), web `portfolio.spec` buy-flow›
- **Given** Toby has a personal entity and a GBP equity security (ISIN GB0031348658, "Rolls-Royce")
- **When** Toby records a buy of 500 shares at £2.80 each (total £1,400)
- **Then** `investment_lots` gains a row: `qty=500`, `cost_basis_minor=140000` (pence), `cost_basis_per_unit_minor=280`, `currency='GBP'`, `status='open'`
- **And** a `ledger_posting_group` (kind=`investment_buy`) is created with balanced TB splits: debit security account, credit cash account; `fx_rate_to_base` is captured from F37 at `open_date`.

**AC2 — Partial FIFO sell computes realised gain and updates lot status**  ‹maps: `LotClosureFifoIT`, `RealisedGainSpec`, web `portfolio.spec` sell-flow›
- **Given** the lot from AC1 is open (500 shares at 280p cost)
- **When** Toby records a sell of 200 shares at £3.50 each (total £700)
- **Then** a `lot_closures` row is created: `qty=200`, `proceeds_minor=70000`, `gain_minor=14000` ((350−280)×200), `term='short'` (< 365 days)
- **And** `investment_lots.status` becomes `partial`; the remaining 300 shares remain open at their original cost basis; the `ledger_posting_group` is balanced (debit cash, credit security account, gain split to income).

**AC3 — Stock split adjusts all open lots; prior closures are immutable**  ‹maps: `CorporateActionSplitIT`, `StockSplitLotAdjustSpec`›
- **Given** the partial lot from AC2 (300 shares remaining, cost basis 280p each)
- **When** Toby applies a 2-for-1 stock split for the security
- **Then** the open lot is updated: `qty=600`, `cost_basis_per_unit_minor=140` (280 / 2); `cost_basis_minor` is unchanged (total cost is preserved)
- **And** the existing `lot_closures` row from AC2 is **not** mutated; no TB posting is created for the split (qty-only adjustment).

**AC4 — Dividend recorded and fed to F38 as capital income**  ‹maps: `DistributionRecordIT`, `DividendF38FeedIT`, web `portfolio.spec` distribution›
- **Given** the open lot from AC3 (600 shares)
- **When** Toby confirms a dividend of £0.10 per share (£60 total, GBP)
- **Then** `distributions` gains a confirmed row: `kind='dividend'`, `amount_minor=6000`; `fx_rate_to_base` captured at `distribution_date`
- **And** `GET /api/investments/portfolio/gains?year=2026` includes £60 dividend income; the F38 deductible/gains feed picks it up; a balanced TB posting is written (debit cash, credit dividend-income account).

**AC5 — DRIP: dividend reinvestment opens a new lot in the same transaction**  ‹maps: `DripAtomicIT`›  *(invariant: DRIP = distribution + lot-open atomic)*
- **Given** a DRIP dividend of £60 resulting in 15 new shares at £4.00
- **When** Toby confirms the DRIP event
- **Then** a `distributions` row (`kind='drip'`, `qty_reinvested=15`) and a new `investment_lots` row (`qty=15`, `cost_basis_minor=6000`, `source_type='drip'`) are both committed **in the same DB transaction**
- **And** if the lot-open fails, the distribution is also rolled back — they never exist independently.

**AC6 — Illiquid holding shows stale-price warning; included at most-recent manual price**  ‹maps: `IlliquidStalePriceIT`, web `portfolio.spec` illiquid-warning›
- **Given** an `is_illiquid=true` security (private equity stake) with a manual price entered 400 days ago and no newer entry
- **When** Toby views the portfolio holdings
- **Then** the holding appears with `price_stale=true` and `staleness_days≥400`; the unrealised gain is computed from the most-recent manual price; a visible warning prompts Toby to update the valuation
- **And** the holding is **not** silently excluded from portfolio totals; its value is included with a staleness annotation.

**AC7 — Investments are Principal-private; no portfolio totals leak to Manager**  ‹maps: `InvestmentsAuthzIT`, web `portfolio.spec` forbidden›  *(invariant: Principal-private — no leak via portfolio totals)*
- **Given** Lorna (Manager) is authenticated
- **When** she requests any endpoint under `/api/investments/*`
- **Then** every response is **403 Forbidden** — no securities, no lot counts, no portfolio totals, no allocation percentages, no gain figures are returned
- **And** the backend test asserts that the F41/F43 consolidated net-worth figure returned to Lorna also excludes investment assets — no arithmetic inference is possible.

**AC8 — No trade-execution endpoint exists (invariant)**  ‹maps: `NoTradeExecutionAssertionIT`›  *(invariant: Kanzen records investments, never executes trades)*
- **Given** the full API surface of `/api/investments/*`
- **When** it is inspected (OpenAPI + weaver test)
- **Then** there is **no endpoint** that submits a buy/sell order to a broker, triggers a brokerage API, or moves money in any direction — recording a lot is explicitly a **past-event record**, not an instruction
- **And** no integration adapter for any brokerage/PIS is present in the codebase.

**AC9 — Agent proposes lot from brokerage statement; Principal confirms in Triage**  ‹maps: `AgentLotProposeIT`, `TriageLotConfirmIT`›  *(invariant: agent proposes, never auto-commits financial/asset creation — F27)*
- **Given** the email agent (F25) processes an inbound brokerage statement PDF containing a new buy
- **When** it parses the document (Bedrock OCR) and extracts `{security, qty, cost_basis, open_date}`
- **Then** a **proposed** `investment_lots` row (`status='proposed'`, `source_type='agent_proposed'`) appears in Triage for Toby to review, edit, and confirm — **no lot is committed without Toby's explicit confirmation**
- **And** the agent's extracted values are stored as an audit trail; if Toby edits before confirming, both the agent's version and Toby's confirmed version are recorded.

## 10. Test plan

### Backend

- **FreeSpec (pure domain rules)**: cost-basis calculation (FIFO, specific-id, partial); realised gain/loss formula; gain term (short vs long); stock-split lot-qty adjustment; DRIP atomicity invariant; no-price / nearest-prior fallback; staleness threshold logic.
- **Weaver + Testcontainers Postgres**: lot CRUD round-trips; lot-closure FIFO ordering; corporate-action application (split, merger); distribution confirm/void; portfolio aggregation (holdings, allocation, gains) against seeded lots; FX-normalised rollup with labelled estimate; authz (Principal-only) on every endpoint; no-trade-execution assertion (no matching endpoint in routing table).
- **TigerBeetle test container**: buy/sell balanced postings; dividend posting; merger inter-account transfer; idempotency (duplicate lot-open attempt); queue-on-TB-down for lot confirmations.
- **Quote-source mock**: live-quote fetch job (upserts prices); provider-down fallback; staleness computation.

### Web

- **Vitest**: holdings table renders (qty, cost basis, current value, gain); allocation treemap data; performance computation; forbidden state; FX label/estimate text; stale-price warning display; lot-detail modal.
- **Playwright** (`portfolio.spec`): Toby logs in → portfolio page shows seeded holdings; add a buy (lot opens); record a sell (realised gain computed); view allocation breakdown; forbidden-as-Lorna (confirms 403 + no data); iliquid-stale warning renders; agent-proposed lot in Triage → confirm → portfolio updates; console-error guard; axe a11y.

## 11. Observability & audit

**Audit** (via `audit_log_entries`): every lot open/close, distribution create/confirm/void, corporate-action apply, manual price entry, security create/edit/delete. Corrections are new audit events, not mutations.

**Metrics**: holdings count by asset class; live-quote fetch success/failure rate + latency; price staleness histogram; lot-open/close events per day; unrealised and realised gain totals (Principal-scoped aggregates); TB posting lag for investment events; proposed-pending count in Triage.

**Alerts**: quote-source consecutive failures → alert; all holdings with no price for > 30 days (liquid) or > 365 days (illiquid) → staleness dashboard flag; TB posting queue depth > 0 for > 5 minutes → alert.

## 12. Open questions / decisions

1. **Quote provider choice** (SETUP): Yahoo Finance (fragile/free) vs Alpha Vantage (key+limit) vs Tiingo vs paid feed. *(Lean: Alpha Vantage free tier for equity/ETF in dev; swap to paid feed for prod.)*
2. **Cost-basis method scope**: FIFO default is correct for UK CGT (actual-cost is allowed for shares); specific-identification is needed for US-style tax lots. Confirm whether the household's advisors require specific-id. *(Lean: FIFO default; specific-id supported but optional.)*
3. **Gain-term definition**: 365-day short/long is a US convention; UK CGT does not distinguish short/long term — all gains taxed at the same CGT rate. Store `term` for F38 US-facing tax reporting, but UK tax summary (F38) uses the raw gain regardless of term. *(Lean: keep `term` as a stored field; UK F38 ignores it; useful for US tax residents.)*
4. **Live-quote frequency**: daily is sufficient for a wealth dashboard; intra-day is rarely needed and triggers API-limit issues on free tiers. *(Lean: daily close prices only.)*
5. **Performance metric (TWR/IRR) precision**: TWR requires sub-period returns at each cashflow date; IRR requires Newton-Raphson iteration on the cashflow schedule. Both are computationally cheap at household scale. *(No open question — implement both.)*
6. **Crypto holdings**: include in `securities` with `asset_class='crypto'`, `is_illiquid=false`; quote source = a crypto price feed (e.g. CoinGecko API — free tier). Wallet addresses are out of scope (recording-only, no on-chain integration).
7. **Private equity / illiquid in multiple entities**: an illiquid holding held partially by the personal entity and partially by a trust — model as two separate lots in two entities, not a fractional single lot. *(Lean: confirmed.)*
