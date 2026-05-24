# Feature F41 — Liabilities & consolidated net worth

| | |
|---|---|
| **Feature ID** | F41 |
| **Milestone** | Wave G (Private Wealth) |
| **Domain** | Private Wealth |
| **Status** | spec complete |
| **Depends on** | F39 (accounting core — chart of accounts, double-entry splits), F42 (entities & structures — entity model, multi-book, consolidation); reads F04/F20 (illiquid assets at valuation), F12 (liquid cash/bank), F40 (investments at market), F37 (FX/display currency), F18 (general ledger) |
| **Spec references** | GnuCash liability accounts (`libgnucash/engine/Account`); the implementation plan; SPEC §8.6 (valuation), §9 (finance) |

> **Decisions:** liability accounts are **F39 chart-of-accounts entries** of type `LIABILITY` (subkinds: `mortgage` / `loan` / `credit_line` / `margin`), posting repayments to the general ledger (F18, hidden in the UI) through the F39 split engine. The **consolidated net worth** view is a **computed, not stored, snapshot** of: liquid cash (F12 balances) + investments at market (F40 prices) + illiquid assets at latest valuation (F04/F20) − total outstanding liabilities — expressed in any **display currency (F37)**, per entity (F42) or consolidated across the full structure. Snapshots are persisted for time-series. **Net worth is Principal-private** — Manager and Staff receive a hard 403 (no leak via totals, aggregates, or partial data). The agent may **propose** new liability records, never auto-commits them (F27, invariant).

---

## 1. Purpose & user value

The headline UHNWI dashboard: every asset the household holds, every debt it owes, combined into a single number — broken down by asset class, entity, currency and liquidity — so the Principal sees wealth clearly and completely, not piecemeal across banking apps, estate-agent portals and brokerage statements.

Concretely:

- **Record and track liabilities** — mortgages (Wardian flat, Singapore), margin loans, personal credit lines — with full terms (principal, rate, schedule, collateral).
- **See outstanding balances move** as repayments post (via the F39 ledger path), removing the need for manual spreadsheet tracking.
- **Consolidate everything into net worth** — liquid + illiquid + investments minus liabilities — with entity-level and group-level views, in any display currency, with a time-series sparkline.
- **Flag staleness** when illiquid valuations are too old to be reliable in the total.

## 2. Roles & permissions

Resources `liability`, `net_worth_snapshot` — **Principal-private** (F02):

- **Principal** — `admin`: full read/write on liabilities and snapshots; sees consolidated net worth across all entities; can set display currency; can trigger a manual snapshot.
- **Manager** — `none`: hard 403 on all F41 endpoints. The Manager operational carve-out (F02) explicitly **does not** extend to net worth, valuations, or liability balances. No aggregated totals, no partial data.
- **Staff** — `none`.
- **The Agent** — may **propose** a new liability (e.g. from an inbound mortgage offer/statement email, F25) via the Triage path (F26/F27); never auto-commits the record or any repayment posting.
- **Entity scope** (F42): net worth is computed per-entity and consolidated; a Principal viewing entity X must not see entity Y data unless they hold the entity-level `admin` grant. The default consolidation scope is "all entities the Principal administers".

## 3. Data model

`V__liabilities_net_worth.sql` (migration in Wave G, after F42 and F39 migrations):

### 3.1 `liabilities`

```sql
CREATE TABLE liabilities (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid        NOT NULL,                         -- Principal
  entity_id            uuid        NOT NULL REFERENCES entities(id), -- F42
  account_id           uuid        NOT NULL REFERENCES accounts(id), -- F39 chart — type=LIABILITY
  kind                 text        NOT NULL CHECK (kind IN (
                                     'mortgage','loan','credit_line','margin')),
  label                text        NOT NULL,                         -- e.g. "Wardian mortgage — Barclays"
  lender               text        NULL,
  principal_minor      bigint      NOT NULL CHECK (principal_minor >= 0),
  currency             text        NOT NULL,                         -- ISO 4217
  outstanding_minor    bigint      NOT NULL,                         -- updated on each repayment posting
  rate_pct             numeric(7,4) NOT NULL,                        -- annual rate, e.g. 4.25
  rate_kind            text        NOT NULL CHECK (rate_kind IN ('fixed','variable','tracker')),
  start_date           date        NOT NULL,
  term_months          int         NULL,                             -- null = revolving/open
  maturity_date        date        NULL,                             -- derived or explicitly set
  schedule             jsonb       NULL,                             -- repayment schedule (see §3.3)
  collateral_asset_id  uuid        NULL REFERENCES assets(id),       -- F04 — e.g. mortgage ↔ Wardian flat
  status               text        NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active','settled','transferred','written_off')),
  notes                text        NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz NULL
);

CREATE INDEX ON liabilities (owner_id);
CREATE INDEX ON liabilities (entity_id);
CREATE INDEX ON liabilities (collateral_asset_id) WHERE collateral_asset_id IS NOT NULL;
```

### 3.2 `net_worth_snapshots`

```sql
CREATE TABLE net_worth_snapshots (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               uuid        NOT NULL,
  -- either entity-level or group-level (null = consolidated across all entities)
  entity_id              uuid        NULL REFERENCES entities(id),
  group_id               uuid        NULL,                           -- F42 consolidation group
  as_of                  timestamptz NOT NULL,                       -- point in time
  display_currency       text        NOT NULL,                       -- ISO 4217 for all minor_units below
  total_liquid_minor     bigint      NOT NULL,                       -- F12 bank/cash balances
  total_investments_minor bigint     NOT NULL,                       -- F40 @ market price
  total_illiquid_minor   bigint      NOT NULL,                       -- F04/F20 @ latest valuation
  total_assets_minor     bigint      NOT NULL,                       -- liquid + investments + illiquid
  total_liabilities_minor bigint     NOT NULL,                       -- sum outstanding_minor, FX-normalised
  net_worth_minor        bigint      NOT NULL,                       -- total_assets − total_liabilities
  breakdown              jsonb       NOT NULL DEFAULT '{}',          -- see §3.4
  valuation_staleness    jsonb       NULL,                           -- see §3.5
  intercompany_eliminated_minor bigint NOT NULL DEFAULT 0,           -- F42 IC elimination amount
  kind                   text        NOT NULL DEFAULT 'scheduled'
                                     CHECK (kind IN ('scheduled','manual','on_demand')),
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON net_worth_snapshots (owner_id, as_of DESC);
CREATE INDEX ON net_worth_snapshots (entity_id, as_of DESC) WHERE entity_id IS NOT NULL;
```

### 3.3 Repayment schedule (`liabilities.schedule` JSONB)

Structured as a list of upcoming scheduled transactions (mirrors F15 recurring bills concept, but liability-specific):

```json
{
  "frequency": "monthly",
  "day_of_month": 1,
  "next_due": "2026-06-01",
  "payment_amount_minor": 150000,
  "payment_currency": "GBP",
  "interest_component_minor": 55000,
  "principal_component_minor": 95000
}
```

The schedule drives **scheduled transactions** (F15 mechanism): on `next_due`, a proposed repayment transaction surfaces in the Pay queue (F16), which Toby confirms — then posts through F39 splits to the general ledger, reducing `outstanding_minor`. Kanzen never initiates payment (invariant).

### 3.4 Breakdown JSONB (`net_worth_snapshots.breakdown`)

```json
{
  "by_asset_class": {
    "liquid":       { "minor": 4500000, "currency": "GBP" },
    "investments":  { "minor": 32000000, "currency": "GBP" },
    "illiquid":     { "minor": 185000000, "currency": "GBP" }
  },
  "by_entity": [
    { "entity_id": "...", "entity_name": "Personal",   "net_minor": 120000000 },
    { "entity_id": "...", "entity_name": "Kanzen Pte",  "net_minor": 65000000  }
  ],
  "by_currency_native": [
    { "currency": "GBP", "assets_minor": 165000000, "liabilities_minor": 20000000 },
    { "currency": "SGD", "assets_minor": 68000000,  "liabilities_minor": 5000000  }
  ],
  "liabilities_detail": [
    {
      "liability_id": "...",
      "label": "Wardian mortgage — Barclays",
      "kind": "mortgage",
      "outstanding_minor": 18000000,
      "currency": "GBP",
      "collateral_asset_id": "..."
    }
  ]
}
```

### 3.5 Valuation staleness JSONB (`net_worth_snapshots.valuation_staleness`)

```json
{
  "stale_threshold_days": 365,
  "stale_count": 2,
  "stale_assets": [
    {
      "asset_id": "...",
      "title": "Wardian Apt 5206",
      "last_valued_at": "2024-09-01",
      "days_stale": 630
    }
  ],
  "stale_value_minor": 90000000,
  "stale_value_pct": 0.41
}
```

If `stale_count > 0`, the net-worth figure carries a **staleness warning** (not suppressed). The threshold is configurable per snapshot kind.

## 4. API (Tapir endpoints)

All endpoints are **Principal-only** (Authorizer default-deny; 403 for any non-Principal caller).

### Liabilities

- `GET /api/liabilities` — list, optionally `?entity_id=&status=&kind=`. Returns `[LiabilityView]` (includes collateral asset title if linked).
- `GET /api/liabilities/:id` — single liability detail + repayment schedule + recent postings.
- `POST /api/liabilities` — create (body: `CreateLiabilityRequest`). Validates: entity exists and belongs to owner; account_id is of type `LIABILITY` in F39; if `collateral_asset_id`, asset must be owned and in scope; money fields non-negative; `outstanding_minor ≤ principal_minor`. **Audit write.** Returns `201 Created`.
- `PATCH /api/liabilities/:id` — update terms, schedule, status, notes. Updates `updated_at`. **Audit write.** Returns `200`.
- `POST /api/liabilities/:id/repayment` — record a manual repayment (amount, date, note) → creates an F39 split transaction proposal (same Triage path as any financial write, F26/F27; reduces `outstanding_minor` on confirmation). **Does not move money.** Returns `202 Accepted` (proposed).
- `DELETE /api/liabilities/:id` — soft-delete (`deleted_at = now()`). Returns `204`.

### Net Worth

- `GET /api/net-worth` — compute **on-demand** net worth as of `now` (or `?as_of=`), optionally `?entity_id=` or `?group_id=` (default: consolidated). Returns a `NetWorthView` (all components + breakdown + staleness). **Not persisted unless `?persist=true`.**
- `GET /api/net-worth/snapshots` — paginated list of persisted snapshots, `?entity_id=&from=&to=`.
- `GET /api/net-worth/snapshots/:id` — single snapshot detail (full breakdown JSONB).
- `POST /api/net-worth/snapshots` — manually trigger + persist a snapshot. Returns `201 Created`.
- `GET /api/net-worth/time-series` — lightweight list for sparkline: `[{as_of, net_worth_minor, display_currency}]`, `?entity_id=&from=&to=&interval=monthly`.

A **scheduled snapshot job** (EventBridge/cron, configurable — default daily) calls the on-demand compute and persists, so the time series is populated without manual action.

### OpenAPI
All endpoints documented at `/docs` under `Private Wealth / Liabilities & Net Worth`.

## 5. UI / screens & states

### 5.1 Net Worth dashboard (headline UHNWI screen)

Under **Wealth** in the left nav (or a top-level "Wealth" section added in Wave G). Full Principal-only; Lorna/Marcia/Siti see a hard "Access denied" page.

**Summary bar:**
- Net worth figure (large, tabular numerals) in the chosen display currency.
- Trend: change vs 30 days ago (absolute + %).
- If valuation staleness present: a **yellow staleness banner** ("2 valuations are over 12 months old — update to improve accuracy").

**Asset breakdown panel** (horizontal stacked bar or segmented KvCard row):
- Liquid (bank/cash) | Investments | Illiquid (registry)
- Each segment shows the minor-unit total in display currency + native-currency breakdown expandable.

**Liabilities panel:**
- List of active liabilities (label, kind pill, outstanding balance, collateral asset link if set).
- Total liabilities row.

**Net worth over time** (sparkline / bar chart):
- Monthly snapshots, configurable range (3M / 1Y / 5Y / all).
- Toggle: per entity vs consolidated.

**Entity breakdown table** (only when >1 entity):
- Columns: entity name, total assets, total liabilities, net worth, display-currency amounts.
- Intercompany elimination row if applicable.

**States:** loading (skeleton), empty (no liabilities + no valuations: onboarding prompt), error, populated, **staleness warning**.

### 5.2 Liabilities detail screen

Under **Wealth → Liabilities** (or reachable from a liability row in the dashboard).

- Liability list with filter (kind, entity, status).
- **Liability detail card/drawer**: label, lender, kind, terms (principal, rate, start/maturity), outstanding balance, next repayment + amount + date, collateral asset link (opens F04 asset detail), repayment history, notes.
- **Add liability** flow: multi-step form (kind → terms → schedule → collateral → review); validates before save.
- **Record repayment** action: amount, date, note → proposed in Triage (F26).

### 5.3 Collateral link on asset detail (F04 cross-reference)

On the **F04 asset detail** page (§5 of F04), when an asset has a `collateral_asset_id` back-link: a KvCard row in the sidekick showing "Secured against: [Liability label] — outstanding £X" (Principal-only; field-stripped for Manager/Staff).

### 5.4 States (all screens)

| State | Behaviour |
|---|---|
| Loading | Skeleton placeholders, no flicker |
| Empty — no liabilities | "No liabilities recorded" with an Add action |
| Empty — no snapshots | Net worth computed on-demand; prompt to schedule daily snapshots |
| Staleness warning | Banner with count + "Update valuations" link to F20 |
| Error | Problem+JSON error message; retry |
| Forbidden (non-Principal) | Full-page "Access denied" — no partial data |

## 6. Business rules & validation

1. **Outstanding cannot exceed principal.** `outstanding_minor ≤ principal_minor`; any repayment that would push it negative is rejected (`400`).
2. **Money is integer minor units + ISO currency, never float.** All amounts stored as `bigint`; display formatting in the web layer.
3. **FX consolidation in display currency.** When consolidating liabilities or net worth across entities with different base currencies, each component is converted using `fx_rates` (F37) at the snapshot's `as_of` date (for historical snapshots) or the latest daily rate (for on-demand). The native amounts are **always preserved** in `breakdown`; the display-currency total is labelled as "estimated at [date] rates".
4. **Intercompany elimination (F42).** When consolidating across entities in the same structure (e.g. a personal entity loaned cash to a subsidiary), the consolidated net-worth computation calls the F42 `IntercompanyEliminator`: loans from one entity to another in the same group are excluded from both assets and liabilities to avoid double-counting. The eliminated amount is stored in `intercompany_eliminated_minor` and shown in the entity table.
5. **Collateral link integrity.** If a `collateral_asset_id` is set: the asset must exist, be owned by the same `owner_id`, and not be soft-deleted. Soft-deleting a collateral asset does **not** cascade-delete the liability — the link is marked stale and flagged in the UI.
6. **Illiquid valuation staleness.** When computing net worth, each registry asset (F04) contributing to `total_illiquid_minor` is checked against its latest F20 valuation snapshot. Any asset with no valuation more recent than `stale_threshold_days` (default 365, configurable) contributes to the staleness report. The total is **not suppressed** — the best-available (stale) valuation is used, but the staleness flag is set.
7. **Repayment is a proposal, not an auto-commit.** `POST /api/liabilities/:id/repayment` creates an F27 proposal surfaced in Triage (F26). Only after Principal confirmation is the F39 split transaction created, the the general ledger posting made, and `outstanding_minor` decremented. Kanzen never initiates payment.
8. **Snapshot immutability.** Persisted `net_worth_snapshots` rows are never mutated after creation (corrections create a new snapshot). The previous row is retained for audit/history.
9. **Default deny.** Any F41 resource returned to a Manager or Staff caller is a hard `403` from the Authorizer (F02). No aggregate totals, no counts, no partial fields.
10. **Negative net worth** is valid and must render correctly (e.g. during a renovation financed by a loan before asset values recover). The net worth figure is signed; the UI shows it in red with a "−" prefix.

## 7. Integrations / external systems

| System | Role |
|---|---|
| **F39 Accounting core** | Liability accounts live in the chart of accounts (`kind = LIABILITY`); all repayment postings route through F39 balanced splits → the general ledger |
| **F42 Entities & structures** | Every liability is entity-scoped; consolidation (including intercompany elimination) uses the F42 entity graph |
| **F04 Asset registry** | Collateral link to assets; illiquid asset set for net-worth computation |
| **F20 Valuation** | Latest valuation snapshot per illiquid asset is the illiquid component; staleness check against `valued_at` |
| **F12 Bank ingestion** | Cash/bank balances (F12 `financial_accounts.balance_minor`) are the liquid component |
| **F40 Investments** | Holdings at current market price are the investment component |
| **F37 FX** | All cross-currency consolidation uses `fx_rates` daily snapshots |
| **F18 the general ledger** | Repayment postings (via F39 splits) are recorded in the general ledger; the ledger is never exposed in the net-worth UI |
| **F15 Bills / F16 Pay queue** | Liability repayment schedule generates scheduled transactions (same mechanism as F15); surfaces in F16 Pay queue |
| **F26/F27 Triage / Trust** | Agent-proposed liabilities and repayment confirmations route through Triage |
| **F34 Events** | `liability.created`, `liability.repayment_confirmed`, `net_worth.snapshot_taken` events emitted |
| **F30 Backup/restore** | Liability rows + snapshots included in full backup |

No external payment provider — Kanzen is read-only / record-only for repayments (invariant).

## 8. Edge cases

1. **Liability secured by a registry asset (collateral link).** The mortgage on Wardian Apt 5206 is linked to the asset via `collateral_asset_id`. The asset detail page (F04) shows the "Secured against" KvCard (Principal-only). If the asset is later restructured (F24) or soft-deleted, the liability link is flagged stale (not silently broken).

2. **FX consolidation across entities in different base currencies.** Entity A (UK personal) holds GBP liabilities; Entity B (Kanzen Pte Ltd, Singapore) holds SGD liabilities. Consolidation converts each at the snapshot's `as_of` ECB rate, labelling the result "estimated at [date] rates". Native-currency breakdown is always shown alongside.

3. **Intercompany elimination (F42).** If the personal entity lent £500,000 to the SPV (recorded as an asset in the personal books and a liability in the SPV books), the F42 eliminator removes both entries from the consolidated view. The eliminated amount appears as a disclosure line.

4. **Illiquid valuation staleness.** An art collection was last valued 18 months ago. The net-worth total uses that stale figure but the staleness banner fires. If **all** illiquid assets are stale, the total_illiquid component is shown with a "⚠ values may be outdated" inline note (not hidden or zeroed).

5. **Negative net worth.** Toby takes a bridging loan to finance a renovation; the loan is larger than the current book value of the property. Net worth goes negative. The dashboard renders the signed negative figure correctly (red, "−£120,000"). No validation rejects a negative result — it is a valid financial state.

6. **Entity in a different base currency than the display currency.** The Singapore entity's books are SGD-denominated. When the Principal's display currency is GBP, every Singapore balance is converted. The entity breakdown table shows both native (SGD) and display (GBP) amounts.

7. **Settled liability.** When `outstanding_minor` reaches zero (all repayments confirmed), the liability status transitions to `settled`. It remains visible in history but is excluded from the active liabilities panel and from `total_liabilities_minor` in future snapshots.

8. **On-demand computation with no F40 prices.** If a security in the investments component has no current price in the F40 price database, its contribution is either omitted (conservative) or uses the last known price with a staleness flag — never silently zero. The behaviour is configurable and the UI surfaces it.

9. **Principal revokes entity access mid-session.** If the entity grant changes between page load and a refresh, the net-worth endpoint recomputes scope on every call (not cached per session). The UI re-fetches on focus-return.

10. **Clock skew on scheduled snapshot job.** The daily EventBridge snapshot job is idempotent: if a snapshot already exists for `as_of` = today (same `entity_id`/`group_id`), the job skips rather than duplicating.

## 9. Acceptance scenarios (UAT)

Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Create a mortgage liability and verify it appears in net worth**  
‹maps: `LiabilityCreateIT` (weaver + Testcontainers), web `net-worth.spec` liability-create›
- **Given** Toby has the Wardian flat (F04 asset) and a chart of accounts with a `LIABILITY` account (F39)
- **When** Toby creates a mortgage liability (£1,800,000 outstanding, 4.25% fixed, linked to the Wardian flat asset)
- **Then** the liability is persisted with `outstanding_minor = 180000000` (pence), the collateral link is set, and the net worth dashboard's total liabilities increases by the same amount in GBP
- **And** the audit log records the creation event.

**AC2 — Repayment is proposed, not auto-committed**  
‹maps: `LiabilityRepaymentProposeIT`, web `net-worth.spec` repayment-propose›  
*(invariant: agent proposes, never auto-commits; Kanzen never moves money)*
- **Given** the Wardian mortgage is active
- **When** Toby (or the agent, F25) submits `POST /api/liabilities/:id/repayment` with the monthly amount
- **Then** a Triage proposal is created (F26) — `outstanding_minor` is **not** yet reduced, no the general ledger posting is made
- **And** only after Toby confirms in Triage does `outstanding_minor` decrease and the F39 split post to the general ledger; the ledger remains hidden in the UI.

**AC3 — Consolidated net worth across entities in display currency**  
‹maps: `NetWorthConsolidationIT`, web `net-worth.spec` consolidation›
- **Given** two entities: Personal (GBP) with liquid £45,000, illiquid £1,800,000, liabilities £1,800,000; Kanzen Pte (SGD) with investments SGD 420,000, liabilities SGD 50,000
- **When** Toby requests `GET /api/net-worth?display_currency=GBP`
- **Then** the SGD amounts are converted at the ECB rate for `as_of`, the consolidated net-worth is `(45,000 + 1,800,000 + investments_in_GBP) − (1,800,000 + liabilities_SGD_in_GBP)`, and the breakdown shows both native and display-currency amounts
- **And** the response is labelled "estimated at [date] rates" and no amounts are silently blended without attribution.

**AC4 — Intercompany elimination**  
‹maps: `IntercompanyEliminationIT`›  
*(invariant: consolidated totals must not double-count internal loans)*
- **Given** the personal entity has a £500,000 inter-entity loan asset to the SPV (F42), which the SPV records as a £500,000 liability
- **When** the consolidated net-worth is computed for the full structure
- **Then** both the £500,000 asset and the £500,000 liability are eliminated from the consolidated total, and the `intercompany_eliminated_minor = 50000000` is disclosed in the breakdown
- **And** the per-entity views still show the loan correctly (elimination applies only at consolidation level).

**AC5 — Illiquid valuation staleness flag**  
‹maps: `ValuationStalenessIT`, web `net-worth.spec` staleness-banner›
- **Given** the Wardian flat's last F20 valuation snapshot is dated 18 months ago (beyond the 365-day threshold)
- **When** Toby loads the net worth dashboard
- **Then** the staleness banner appears ("1 valuation is over 12 months old"), the illiquid total uses the stale value (not zeroed), and `valuation_staleness.stale_count = 1`
- **And** a link from the banner navigates to the F20 valuation tab.

**AC6 — Net worth is Principal-private (hard 403)**  
‹maps: `NetWorthAuthzIT`, web `net-worth.spec` forbidden›  
*(invariant: net worth + valuations Principal-private; no leak via consolidated totals)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either calls `GET /api/net-worth`, `GET /api/liabilities`, or `GET /api/net-worth/snapshots`
- **Then** both receive `403 Forbidden` — no figure, no count, no partial breakdown, no error message that leaks the structure's existence
- **And** the web UI renders a full-page "Access denied" state (not a loading spinner or empty list).

**AC7 — Negative net worth renders correctly**  
‹maps: `NegativeNetWorthRenderSpec` (FreeSpec), web `net-worth.spec` negative›
- **Given** a bridging loan of £2,000,000 is recorded as a liability, while total assets are £1,800,000
- **When** the net worth is computed
- **Then** `net_worth_minor = -20000000` (negative) is returned and the dashboard displays "−£200,000" in red with no validation error or UI crash
- **And** the liability amount and asset total are both shown in the breakdown with correct signs.

**AC8 — Collateral link displayed on asset detail**  
‹maps: `CollateralLinkIT`, web `asset-detail.spec` collateral-kv›
- **Given** the Wardian flat (F04) is set as `collateral_asset_id` on the Wardian mortgage liability
- **When** Toby opens the asset detail page for the flat
- **Then** the sidekick KvCard shows "Secured against: Wardian mortgage — Barclays — outstanding £X" in the correct display currency
- **And** Lorna (Manager) opening the same asset detail sees no collateral row — it is field-stripped server-side (403 on that field).

**AC9 — Snapshot immutability and time-series**  
‹maps: `SnapshotImmutabilityIT`, web `net-worth.spec` time-series›
- **Given** a persisted net-worth snapshot for 2026-05-01 and another for 2026-06-01
- **When** an asset valuation is updated (making the May figure outdated)
- **Then** the May snapshot is unchanged (immutable); the June snapshot reflects the new valuation; the time-series sparkline shows both historical points correctly
- **And** a new on-demand snapshot captures the updated figure as a third distinct row.

## 10. Test plan

- **Backend (weaver + Testcontainers + FreeSpec):**
  - `LiabilityCreateIT` — round-trip create/read/soft-delete with entity + collateral FK validation.
  - `LiabilityRepaymentProposeIT` — repayment creates a Triage proposal, outstanding unchanged; confirmation path reduces outstanding and posts to F39/the general ledger (mocked).
  - `NetWorthConsolidationIT` — multi-entity, multi-currency consolidation with FX snapshots; verify native amounts preserved and display total matches manual calculation.
  - `IntercompanyEliminationIT` — two-entity IC loan is eliminated at consolidation; per-entity views unaffected.
  - `ValuationStalenessIT` — staleness detection at threshold boundary (364 days = clean, 366 days = stale); `stale_count` and `stale_value_minor` correct.
  - `NegativeNetWorthSpec` (FreeSpec) — signed arithmetic correct; render path does not clamp at zero.
  - `CollateralLinkIT` — link + stale-link (soft-deleted asset) detection.
  - `SnapshotImmutabilityIT` — existing snapshot not mutated on re-compute; idempotent job skips duplicate.
  - `NetWorthAuthzIT` — Manager (`Lorna`) and Staff (`Marcia`) each receive `403` on every F41 endpoint; no partial data in error body.
  - `OutstandingBoundarySpec` (FreeSpec) — `outstanding > principal` rejected `400`.

- **Web (Vitest + Playwright):**
  - Vitest: `net-worth.service.spec.ts` (Zod schema, consolidation request/response), `liability.service.spec.ts` (create/repayment request schema).
  - Playwright `net-worth.spec.ts`: full flow (login as Toby → see dashboard → add liability → verify total updates); staleness banner; entity-toggle; sparkline renders; forbidden state as Manager (Lorna).
  - Playwright `asset-detail.spec.ts`: collateral KvCard present for Principal, absent for Manager.
  - axe a11y pass on all F41 screens (light + dark).
  - Visual diff baseline: net-worth dashboard (populated, negative, staleness) × light + dark.

## 11. Observability & audit

**Audit log entries** (via `AuditWriter`, F00):
- `liability.created` — `owner_id`, `entity_id`, `kind`, `principal_minor`, `currency`.
- `liability.updated` — changed fields (diff).
- `liability.repayment.proposed` — proposed amount, date.
- `liability.repayment.confirmed` — amount, GL posting reference.
- `liability.settled` — final outstanding, settlement date.
- `net_worth.snapshot.taken` — `as_of`, `net_worth_minor`, `display_currency`, `kind`.

**Metrics (Prometheus):**
- `kanzen_liabilities_total` (gauge, by entity + kind).
- `kanzen_net_worth_minor` (gauge, by entity + display_currency — **only emitted for Principal-authenticated scrape**; not exposed to non-Principal metrics endpoints).
- `kanzen_valuation_stale_assets` (gauge, by entity).
- `kanzen_net_worth_snapshot_duration_ms` (histogram).
- `kanzen_authz_forbidden_total{resource="net_worth"}` (counter — tracks access-denial attempts).

## 12. Open questions / decisions

1. **Display currency default.** Should the net-worth dashboard default to the Principal's profile display currency (F37), or always GBP as the household base? *(Lean: use the F37 display preference; fallback to GBP.)*

2. **Snapshot frequency and retention.** Daily snapshots accumulate fast. Should snapshots older than N years be down-sampled (e.g. keep monthly beyond 2 years)? *(Lean: yes, configurable; default: daily for 2 years → monthly beyond.)*

3. **Investments staleness.** F40 prices may be intraday or end-of-day. Should the net-worth snapshot flag "price data N hours old" for market instruments, analogous to the illiquid valuation staleness? *(Lean: yes, configurable threshold per asset class.)*

4. **Liability import from PDF statement.** The agent (F25) could extract outstanding balance + rate from an emailed mortgage statement and propose an update to `outstanding_minor`. Is this in F41 scope or F25 scope? *(Lean: the extraction is F25; the proposed update routes through F41's `PATCH` endpoint via F27 Triage — no new feature needed.)*

5. **Credit-line utilisation.** A revolving credit line has both a `limit` and a current `outstanding`. Should the schema store `credit_limit_minor` separately for utilisation-rate display? *(Lean: yes, add `credit_limit_minor bigint null` — present only for `kind = 'credit_line'`; utilisation = `outstanding / limit`.)*

6. **Margin loan mark-to-market.** A margin loan's outstanding balance may be called if the collateral investment falls in value (margin call). Should F41 flag proximity to a margin call threshold? *(Lean: flag when `outstanding / collateral_market_value > configurable_ltv_threshold`; deferred to a post-Wave-G enhancement.)*
