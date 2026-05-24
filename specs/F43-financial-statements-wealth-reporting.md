# Feature F43 — Financial statements & wealth reporting

| | |
|---|---|
| **Feature ID** | F43 |
| **Milestone** | Wave G (Private Wealth) |
| **Domain** | Private Wealth |
| **Status** | spec complete |
| **Depends on** | F39 (accounting core / chart of accounts + splits), F40 (investments + securities), F41 (liabilities + net worth), F42 (entities, structures + accounting periods); F37 (FX / display currency); ties to F17 (budgets → Budget vs Actual), F38 (tax year framing + deductibility), F29 (informal insights — superseded here for wealth reporting), F30 (export / PDF / CSV) |
| **Spec references** | GnuCash report suite (`gnucash/report/`), plan §O / §O.1 |

> **Decisions:** financial statements are **generated directly from the double-entry ledger** (F39 splits + F42 accounting periods) — not re-derived from the transactional domain tables. They are **read-only** (no statement mutates the books). Every statement is **entity-scoped** (F42 entity or consolidated group) and **period-scoped** (F42 accounting period, e.g. 2025 calendar year, 2025/26 UK tax year). **Multi-currency translation uses period-end rates** for balance-sheet items and **average-period rates** for income-statement items (the temporal method), with full labelling (see §6). **Principal-private**: no Manager or Staff access except a documented carve-out for Budget vs Actual (open question, §12). The Agent has no write path here; it is read-only reporting. **Drill-down from a statement line → chart-of-accounts register → splits** (F39) but **never to raw TigerBeetle IDs** — the ledger is always hidden in the UI (CLAUDE.md invariant).

---

## 1. Purpose & user value

Turn the household's double-entry books (F39–F42) into the standard financial statements a UHNWI owner, accountant, or advisor would expect: **Balance Sheet**, **Income Statement (P&L)**, **Cash Flow Statement**, **Trial Balance**, and **Budget vs Actual** (F17) — all per entity (personal / trust / Ltd / SPV) and for a consolidated group (F42). Add private-wealth lenses on top: **net-worth-over-time**, **asset allocation** across illiquid registry + liquid cash + investments (F40), **liquidity / concentration** analysis, and investment **performance** (F40). Every statement can be exported (CSV / PDF via F30) in a form an accountant can open without further reformatting.

This is the reporting crown on the Wave G accounting stack: the books are only as useful as the reports you can pull from them.

## 2. Roles & permissions

Resources `report_definitions`, `saved_reports`, `report_runs` — **Principal-private** (F02):

| Role | Access |
|---|---|
| **Toby (Principal)** | `admin` — full access to all statements, all entities, all exports |
| **Lorna (Manager)** | `none` by default — see §12 open question re Budget vs Actual carve-out |
| **Marcia / Siti (Staff)** | `none` |
| **The Agent** | N/A — read-only reporting, no write path through the agent |

The **entity scope** in F42 is enforced on every query: a report for Entity A must never include accounts or splits from Entity B, including via consolidated totals. **Consolidation eliminations are computed and labelled server-side** — intercompany balances eliminated in the group view are never exposed as raw totals.

## 3. Data model

`V__financial_statements.sql`:

- **`report_definitions`** — persisted report templates:
  ```
  id                  uuid default gen_random_uuid() PK
  owner_id            uuid not null  REFERENCES users(id)
  entity_id           uuid null      REFERENCES entities(id)   -- null = consolidated group
  group_id            uuid null      REFERENCES entity_groups(id)
  kind                text not null  -- balance_sheet | income_statement | cash_flow
                                     --   trial_balance | budget_vs_actual
                                     --   net_worth_over_time | asset_allocation
                                     --   liquidity_concentration | investment_performance
  name                text not null
  params              jsonb not null  -- period_id, comparative_period_id, currency,
                                      --   basis (accrual|cash), level_of_detail, filters
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
  deleted_at          timestamptz null
  CONSTRAINT owner_entity_or_group CHECK (
    (entity_id is not null) != (group_id is not null) or
    (entity_id is null and group_id is null)   -- personal (no explicit entity)
  )
  ```

- **`saved_reports`** — user-facing saved/named views of report_definitions:
  ```
  id                  uuid default gen_random_uuid() PK
  owner_id            uuid not null
  definition_id       uuid not null  REFERENCES report_definitions(id)
  label               text not null
  pinned              bool not null default false
  created_at          timestamptz not null default now()
  deleted_at          timestamptz null
  ```

- **`report_runs`** — each execution of a definition (lazy/on-demand or scheduled):
  ```
  id                  uuid default gen_random_uuid() PK
  owner_id            uuid not null
  definition_id       uuid not null  REFERENCES report_definitions(id)
  period_label        text not null  -- human label e.g. "FY 2025" or "2025/26 tax year"
  generated_at        timestamptz not null default now()
  result              jsonb null     -- serialised statement rows (null while pending/failed)
  status              text not null  -- pending | complete | failed
  error               text null
  export_id           uuid null      -- REFERENCES export_jobs(id) when exported via F30
  fx_basis_label      text null      -- e.g. "period-end rate 31 Dec 2025 (GBP)" or "avg 2025"
  ```

All PKs `uuid default gen_random_uuid()`; `owner_id` on every row; `timestamptz`; soft-delete via `deleted_at`; all writes audited. **Money in result jsonb = integer minor units + ISO currency code, never float.** The `result` jsonb follows a versioned schema (included in the run row for forward-compatibility with F30 restore).

## 4. API (Tapir endpoints)

All endpoints are **Principal-only** (Tapir security partial → `Principal`; `Authorizer.requireAdmin`).

### Report definitions
- `GET  /api/reports/definitions`                         — list saved definitions (own).
- `POST /api/reports/definitions`                         — create a definition.
- `GET  /api/reports/definitions/:id`                     — get one.
- `PATCH /api/reports/definitions/:id`                    — update params / name.
- `DELETE /api/reports/definitions/:id`                   — soft-delete.

### Saved reports (pinned / named views)
- `GET  /api/reports/saved`                               — list.
- `POST /api/reports/saved`                               — pin a definition.
- `DELETE /api/reports/saved/:id`                         — unpin.

### Report runs (generate / retrieve)
- `POST /api/reports/run`                                 — body: `{definitionId, periodId, comparativePeriodId?, currency?}` → triggers generation; returns `report_run` with `status=pending` (or `complete` if fast).
- `GET  /api/reports/runs/:id`                            — poll for status + result.
- `GET  /api/reports/runs/:id/export`                     — trigger F30 export (CSV or PDF); returns `exportJobId`.

### Statement-type convenience endpoints (stateless, ad-hoc)
- `GET  /api/reports/balance-sheet?entityId=&periodId=&currency=`
- `GET  /api/reports/income-statement?entityId=&periodId=&comparativePeriodId=&currency=`
- `GET  /api/reports/cash-flow?entityId=&periodId=&currency=`
- `GET  /api/reports/trial-balance?entityId=&periodId=&currency=`
- `GET  /api/reports/budget-vs-actual?entityId=&periodId=&budgetId=`
- `GET  /api/reports/net-worth-over-time?entityId=&from=&to=&granularity=month|quarter|year`
- `GET  /api/reports/asset-allocation?entityId=&asOfDate=&currency=`
- `GET  /api/reports/liquidity-concentration?entityId=&asOfDate=&currency=`
- `GET  /api/reports/investment-performance?entityId=&from=&to=&currency=` (wraps F40)

All return a typed `StatementResult` (rows + metadata: entity, period, currency, fx_basis_label, as-of timestamp, `is_draft` flag for an unclosed period).

### Drill-down
- `GET  /api/reports/account-detail?accountId=&periodId=` → account register (splits from F39, within the period) — **shows account names and amounts only; never exposes TigerBeetle internal IDs**.

## 5. UI / screens & states

### Reports screen (top-level nav item under Finance or a dedicated "Wealth" section)

**Statement picker / header**
- Entity selector (personal / each entity / consolidated group — F42 entities the Principal owns).
- Period selector (accounting periods from F42 + tax-year shortcuts from F38).
- Statement type tabs: Balance Sheet · Income Statement · Cash Flow · Trial Balance · Budget vs Actual · (Wealth sub-section: Net Worth · Allocation · Liquidity · Performance).
- Comparative period toggle (side-by-side prior period column).
- Display currency selector (via F37 — "Native" or a single target currency).
- Export button (CSV / PDF via F30).

**Balance Sheet**
- Two-column layout: Assets | Liabilities + Equity.
- Hierarchical account tree (F39 chart of accounts); collapsible sub-accounts.
- Drill: click an account line → opens account register (splits for the period).
- FX translation note: balance-sheet items use **period-end rate** (stated inline: "translated at GBP/SGD 1.042 as of 31 Dec 2025").
- `is_draft` banner when the period has not been closed (F42).

**Income Statement (P&L)**
- Revenue − Expenses = Net Income; hierarchical; comparative period column.
- FX translation note: income/expense items use **average-period rate** (stated inline).

**Cash Flow Statement**
- Operating / Investing / Financing activities (indirect method); net change in cash.

**Trial Balance**
- Flat account list: debit balances | credit balances; total row (must balance).

**Budget vs Actual**
- Per account / category: Budget | Actual | Variance | % Used.
- Pulls budget from F17 `budgets` and actual from the ledger for the same period.

**Wealth sub-section**

*Net Worth Over Time* — area chart; selectable granularity (month / quarter / year); illiquid assets (F20 valuation) + liquid cash (F39 accounts) + investments (F40) − liabilities (F41); per entity or consolidated; FX labelled.

*Asset Allocation* — donut / bar: illiquid real estate · collectibles · liquid cash · equities · fixed income · other; by entity or consolidated; as-of date.

*Liquidity & Concentration* — liquidity ladder (0–30d / 30–90d / >90d / illiquid); top-N concentration (% of net worth in a single asset/entity); warning when a single asset > configurable% of total.

*Investment Performance* (wraps F40) — portfolio return (TWR / MWR); benchmark comparison; by entity or consolidated.

**States** (all screens):
- Loading (skeleton rows).
- Empty (no accounts in period — "Start by recording transactions in F39").
- Draft (period not closed — labelled banner; figures are provisional).
- Error (calculation failed — message + retry).
- **Forbidden** (any non-Principal → full-screen 403 page; no partial data).
- Export pending / complete (inline status indicator; link to F30 download).

## 6. Business rules & validation

### Statement generation
- Statements are **computed from F39 splits** (balanced double-entry) for the given `(entity, period)`. No direct reads from `bank_transactions`, `expenses`, or other domain tables — those feed the books via F39 postings.
- **Draft vs closed periods** (F42): a statement on an open/draft period renders with an `is_draft=true` flag and a visible banner; figures are provisional and may change. A closed period is immutable.
- **Consolidated statements** (F42): sum entity books after eliminating intercompany transactions (accounts payable/receivable between entities owned by the same Principal). Elimination entries are computed server-side, recorded in the result, and labelled — they are never silently dropped.

### Multi-currency translation
- **Balance-sheet items** (assets, liabilities, equity): translated using the **period-end rate** (the `fx_rates` snapshot for the last day of the period — F37). Method: temporal method for monetary items.
- **Income-statement items** (revenue, expenses): translated using the **average rate** for the period (arithmetic mean of daily `fx_rates` snapshots across the period — F37).
- Every translated statement includes a **`fx_basis_label`** (e.g. "Balance sheet: period-end GBP/SGD 1.042 at 31 Dec 2025; Income: average GBP/SGD 1.038 for Jan–Dec 2025").
- If a required rate is missing for any date in the period, the statement **fails clearly** with a list of missing rate pairs; it does not silently use a wrong rate (§8 edge case).
- Native (per-currency) statements always available; translated statements are clearly labelled as estimates.

### Trial Balance
- The trial balance **must balance** (total debits = total credits). If it does not, generation fails with an explicit error identifying the unbalanced account — this is a data integrity signal (F39 invariant: every transaction is balanced before posting to TigerBeetle).

### Budget vs Actual
- Budget figures sourced from F17 `budgets` (per property + category + period year). Actual figures sourced from F39 splits for matching accounts/categories in the period. Variance = Budget − Actual; sign convention consistent (favourable positive for income, favourable negative for expense overspend).
- If no budget exists for the period, the Budget vs Actual report renders with budget columns empty and a clear note.

### Wealth reporting
- **Net worth** = sum of: illiquid asset valuations (F20, most-recent per asset, at report date) + liquid account balances (F39 asset accounts) + investment market values (F40 `holdings` × `price_history`) − total liabilities (F41). FX-translated at the as-of-date rate.
- **Asset allocation** percentages are computed from net-worth components; rounding across all buckets is resolved so they sum to 100% (distribute remainder to the largest bucket — state this in the result).
- **Concentration warning** threshold is configurable per Principal (default 30% of net worth in a single asset or entity).

### Permission / scope enforcement
- Every query is scoped by `owner_id` first, then `entity_id` (or `group_id` for consolidated).
- **No leak via totals or consolidation**: a consolidated result must not expose individual-entity figures to which the viewer lacks access. Since the Principal has admin over all their own entities this is trivially satisfied, but the logic must be written defensively so a future multi-principal scenario cannot leak. Backend tests assert on the consolidated result schema.
- Drill-down to the account register **shows account names and period-split amounts only** — never raw TigerBeetle account/batch IDs (CLAUDE.md invariant: ledger hidden in the UI).

### Rounding
- All arithmetic on minor-unit integers; rounding only at the final display conversion. If a multi-line statement does not balance by ±1 unit (rounding artefact), the discrepancy is noted in the result with the affected subtotal. It is never silently hidden.

## 7. Integrations / external systems

| System | How used |
|---|---|
| **F39 (accounting core)** | Source of truth — chart of accounts + splits, queried for every statement |
| **F40 (investments)** | Market values + performance figures for wealth sub-section |
| **F41 (liabilities + net worth)** | Liability account balances for balance sheet and net worth |
| **F42 (entities + periods)** | Entity scoping + period boundaries + closed/draft status + consolidation tree |
| **F37 (FX)** | Daily `fx_rates` snapshots for translation; missing-rate detection |
| **F17 (budgets)** | Budget figures for Budget vs Actual |
| **F38 (tax)** | Tax-year period shortcuts; deductible expense totals optionally surfaced |
| **F29 (insights)** | F43 supersedes the informal wealth/net-worth views in F29; F29 retains the operational dashboard widgets (tasks, approvals, registry health) |
| **F30 (backup/export)** | CSV and PDF export via `export_jobs`; `report_runs.export_id` tracks the job |

No external HTTP dependencies at runtime. FX rates are consumed from the F37 `fx_rates` table (populated by the F37 rate-fetch job).

## 8. Edge cases

| Case | Handling |
|---|---|
| **Consolidation eliminations** | Intercompany balances (A/R in one entity vs A/P in another, same group) are identified, eliminated, and logged in the result as a labelled line; the net is shown separately |
| **Mid-period / open period (draft statement)** | Statement rendered with `is_draft=true` banner; user warned figures are provisional; closing the period (F42) re-runs and finalises |
| **Comparative period** | Prior-period figures pulled using the same rules; if the prior period used a different chart of accounts structure (F39 account renamed / moved), differences are reconciled by account ID not name; a note is emitted for structural changes |
| **Multi-currency translation: missing rate** | Generation fails with an itemised list of missing `(base, quote, date)` pairs; never silently wrong |
| **Multi-currency translation: rounding drift** | Rounding artefact of ±1 minor unit noted inline; not silently hidden |
| **Period not yet in F42 (no period record)** | Returns 422 with `period_not_found`; never auto-creates a period |
| **Unbalanced trial balance** | Fails with the offending account(s) identified; this signals an F39 data-integrity issue |
| **No budget for period (Budget vs Actual)** | Budget columns empty; note displayed; actual figures still shown |
| **Concentration > threshold** | Wealth-reporting liquidity/concentration view emits a `concentration_warning` in the result with the asset/entity name and percentage; the UI renders a warning badge |
| **Very large account tree (deep hierarchy)** | Pagination / lazy-expand at depth ≥ 3; statement totals always available regardless of expansion state |
| **Net-worth rounding across many FX conversions** | Rounding is display-only; all intermediate arithmetic in integer minor units; no rounding fed back to the books |

## 9. Acceptance scenarios (UAT)

Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Balance Sheet generates correctly for a single entity and period**  ‹maps: `BalanceSheetSingleEntityIT` (weaver+PG), web `balance-sheet.spec` principal›
- **Given** Entity "Toby Personal" has a closed accounting period (FY 2025, F42) with F39 splits recording: a property asset account (£500,000), a bank account (£25,000), a mortgage liability (£180,000), and equity (£345,000)
- **When** Toby generates the Balance Sheet for Entity "Toby Personal" / FY 2025 in GBP
- **Then** the statement renders with Assets total £525,000, Liabilities total £180,000, Equity total £345,000 (Assets = Liabilities + Equity)
- **And** the period is shown as closed (no draft banner); the as-of timestamp and FX basis label are present.

**AC2 — Consolidated Balance Sheet eliminates intercompany balances**  ‹maps: `ConsolidatedBalanceSheetIT` (weaver+PG)›  *(invariant: consolidation eliminations labelled server-side; no leak)*
- **Given** Entities "Toby Personal" and "Property SPV" in the same group; the personal entity has a £50,000 loan receivable from the SPV; the SPV has a £50,000 loan payable to personal
- **When** Toby generates the consolidated Balance Sheet for the group
- **Then** the £50,000 intercompany receivable and payable are **eliminated** from the consolidated total; a labelled "Intercompany eliminations: £50,000" line is shown in the result
- **And** the consolidated equity matches the sum of individual equities (before elimination adjustments); the elimination is never silently dropped.

**AC3 — Income Statement uses average-period FX rate; Balance Sheet uses period-end rate**  ‹maps: `StatementFxTranslationIT` (FreeSpec + weaver+PG)›  *(invariant: FX translation method labelled; never silently wrong)*
- **Given** Entity "Singapore Trust" with SGD income of SGD 60,000 and SGD 600,000 in assets; FY 2025 average SGD/GBP rate = 0.590; period-end SGD/GBP rate = 0.597
- **When** Toby generates the Income Statement and Balance Sheet for FY 2025 in GBP display currency
- **Then** the Income Statement shows revenue ≈ £35,400 (60,000 × 0.590, average rate) with label "translated at avg SGD/GBP 0.590 for Jan–Dec 2025"
- **And** the Balance Sheet shows the asset ≈ £358,200 (600,000 × 0.597, period-end) with label "translated at period-end SGD/GBP 0.597 as of 31 Dec 2025"; the two rates differ and this is correct behaviour, not a bug.

**AC4 — Trial Balance balances; unbalanced trial balance fails with clear error**  ‹maps: `TrialBalanceIT` (FreeSpec + weaver+PG), web `trial-balance.spec`›
- **Given** a correctly journalled set of F39 splits for FY 2025 (all transactions balanced)
- **When** Toby generates the Trial Balance
- **Then** total debits equal total credits and the statement renders without error
- **And** when a test fixture introduces a single unbalanced entry, generation **fails** with an error naming the unbalanced account and the discrepancy amount; no partial/misleading statement is returned.

**AC5 — Budget vs Actual shows variance; no budget renders gracefully**  ‹maps: `BudgetVsActualIT` (weaver+PG), web `budget-actual.spec`›
- **Given** a FY 2025 budget from F17 for "Household Expenses GBP" category: £36,000; actual F39 splits for the same accounts total £38,400 for the period
- **When** Toby opens Budget vs Actual for FY 2025 in GBP
- **Then** the report shows Budget £36,000 · Actual £38,400 · Variance −£2,400 (overspend) with the variance correctly signed (negative = unfavourable for expense)
- **And** for a category with no matching budget, the budget column is blank and a note is shown; actual figures are still present.

**AC6 — Net Worth Over Time chart shows monthly progression**  ‹maps: `NetWorthOverTimeIT` (weaver+PG), web `net-worth.spec`›
- **Given** Toby has 12 months of closed periods (FY 2025) with changing asset valuations (F20), investment values (F40), and a declining mortgage balance (F41)
- **When** Toby opens Net Worth Over Time for FY 2025 at monthly granularity in GBP
- **Then** the chart renders 12 data points; each point = (illiquid valuations + liquid accounts + investments − liabilities) FX-translated at that month-end's rate (F37)
- **And** the series is monotonically plausible (individual months may vary); the first and last points correspond to confirmed opening/closing balances.

**AC7 — Drill-down from a statement line reaches account register; TigerBeetle IDs never exposed**  ‹maps: `StatementDrillDownIT` (weaver+PG), web `account-register.spec`›  *(invariant: ledger hidden in the UI; drill shows account names + amounts only)*
- **Given** a Balance Sheet with a "Cash at bank" line totalling £25,000
- **When** Toby clicks the line to drill into the account register for the period
- **Then** the register shows the individual splits (date, description, debit/credit, running balance) for that account within the period
- **And** no TigerBeetle account ID, batch ID, or internal posting reference is visible anywhere in the register or in the API response — only human-readable account names and amounts.

**AC8 — Statements are Principal-private; non-Principal receives 403 with no data (negative / permission)**  ‹maps: `ReportAuthzIT` (weaver+PG), web `reports.spec` forbidden›  *(invariant: Principal-private; no leak via totals)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either calls any `GET /api/reports/*` endpoint (balance-sheet, income-statement, net-worth-over-time, etc.)
- **Then** both receive **403 Forbidden** — no statement rows, no totals, no account names are returned; the response body contains only a problem+json error
- **And** the backend test asserts that the Manager-scoped response body is structurally empty of any financial figure; the forbidden attempt is recorded in the audit log.

**AC9 — Draft period statement renders with banner; closing the period re-runs cleanly**  ‹maps: `DraftPeriodStatementIT` (weaver+PG), web `balance-sheet.spec` draft-banner›
- **Given** FY 2026 is the current open/unclosed period (F42 `status=open`)
- **When** Toby generates a Balance Sheet for FY 2026
- **Then** the statement renders with `is_draft=true` and a visible banner: "This period is not yet closed — figures are provisional"
- **And** when Toby closes the period (F42 year-end close) and re-generates, the banner is absent; the result is marked as final and the `report_run` records the closed `period_label`.

## 10. Test plan

**Backend (Scala — weaver-cats + Testcontainers PostgreSQL)**
- `BalanceSheetSingleEntitySpec` (FreeSpec) — account-tree aggregation, debit/credit side assignment, Assets = L + E invariant.
- `ConsolidatedStatementSpec` — consolidation logic, intercompany elimination correctness, group entity scoping.
- `FxTranslationSpec` — average-rate vs period-end-rate per statement type; missing-rate failure; rounding drift.
- `TrialBalanceSpec` — balanced result passes; unbalanced fails with named account.
- `BudgetVsActualSpec` — variance arithmetic, sign convention, missing-budget graceful rendering.
- `NetWorthOverTimeSpec` — monthly series: illiquid + liquid + investments − liabilities, FX at month-end.
- `AssetAllocationSpec` — bucket percentages sum to 100% (rounding distribution rule).
- `ReportAuthzIT` (weaver + Testcontainers) — all endpoints deny Lorna (Manager), Marcia, Siti; confirm Toby (Principal) gets data; response body structurally empty for denied callers.
- `DraftPeriodIT` — `is_draft` flag set for open period; absent after close.
- `DrillDownIT` — account register returns splits with names/amounts; TigerBeetle ID fields absent from response schema.
- `ConcentrationWarningSpec` — warning emitted when a single asset exceeds the threshold percentage.

**Web (Vitest + Playwright)**
- Vitest: statement-row component (account tree, collapsible, drill link); FX-basis label rendering; draft banner; Budget vs Actual variance sign; net-worth chart series; forbidden-state full-screen 403.
- Playwright `financial-statements.spec.ts`:
  - Balance Sheet renders, collapses/expands, drill-down opens account register (no TB IDs in DOM).
  - Income Statement comparative period: two columns correctly labelled.
  - Cash Flow renders activity sections.
  - Budget vs Actual overspend shown with negative variance and visual indicator.
  - Net Worth Over Time chart: 12-month series present.
  - Asset Allocation donut: percentages sum to 100%.
  - Export triggers F30 job; download link appears.
  - Non-Principal (Lorna): full-screen 403; no financial figures in page source.
  - Draft period: banner present; disappears after period close.

## 11. Observability & audit

**Audit entries** (via `AuditWriter`): report definition created / updated / deleted; report run triggered (with `definitionId`, `periodId`, `entityId`, result size); export triggered (with `exportJobId`); forbidden attempt (caller identity, endpoint).

**Metrics** (Prometheus / OpenTelemetry):
- `kanzen_report_run_duration_ms` — histogram by `kind` (balance_sheet, net_worth_over_time, …).
- `kanzen_report_run_total{status=complete|failed}` — generation success rate.
- `kanzen_fx_translation_missing_rate_total` — count of statements that failed due to a missing FX rate.
- `kanzen_report_forbidden_total` — count of 403s on `/api/reports/*` (security signal).
- `kanzen_report_export_total` — CSV vs PDF exports.

**Alerting**: alert if `kanzen_fx_translation_missing_rate_total` rises (F37 rate-fetch job degraded); alert if `kanzen_report_run_total{status=failed}` > threshold.

## 12. Open questions / decisions

1. **Manager carve-out for Budget vs Actual** — expose a read-only Budget vs Actual operational view (budget vs actuals for household categories, no balance-sheet or net-worth figures) to a Manager (Lorna)? *(Lean: opt-in Principal-configurable carve-out only; all other statements remain Principal-private. The carve-out must not leak account balances, equity, or net-worth via the variance column.)*

2. **FX translation method** — this spec adopts **period-end rate for balance-sheet items** and **average-period rate for income-statement items** (consistent with IAS 21 / the temporal method). Confirm with Principal before first production run; locking it post-first-run has historical restatement implications.

3. **Cash Flow method** — indirect method (starts from net income, adjusts for non-cash items) or direct method (actual cash inflows/outflows per category)? *(Lean: indirect, as it follows naturally from the F39 accrual double-entry books; direct requires per-category cash tagging.)*

4. **Consolidation eliminations scope** — which intercompany items are in scope for elimination (loans, dividends, management fees)? Full list to be confirmed when F42 entity types are finalised.

5. **Period granularity for net-worth-over-time** — month | quarter | year are specified; should "week" be supported? *(Lean: no, consistent with F42 accounting-period granularity.)*

6. **Tax-year framing** — tax-year periods (e.g. 6 April–5 April for UK) are defined as a period kind in F42 and referenced by F38. F43 should expose them in the period selector with a shortcut label. *(Decision: yes; confirm period kind labels with F42 spec once written.)*

7. **PDF export format** — formal IFRS-style layout or a clean Kanzen-branded summary? *(Lean: Kanzen-branded, accountant-readable; the F30 PDF renderer handles the layout.)*

8. **Performance attribution** — TWR (time-weighted return) vs MWR (money-weighted / IRR) for investment performance? *(Lean: TWR primary, MWR optional; delegate detail to F40 spec.)*
