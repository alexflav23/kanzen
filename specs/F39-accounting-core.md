# Feature F39 — Chart of accounts & double-entry transactions

| | |
|---|---|
| **Feature ID** | F39 |
| **Milestone** | Wave G |
| **Domain** | Private Wealth |
| **Status** | spec complete |
| **Depends on** | F42 (entities/books), F18 (TigerBeetle ledger), F37 (currencies/FX), F14 (reconciliation) |
| **Spec references** | GnuCash `Account`/`Transaction`/`Split` model; `00-master-implementation-plan.md`; SPEC §9 (finance); F18 (TB posting engine) |

> **Decisions:** a GnuCash-style chart of accounts + double-entry transaction/split engine, modernised on top of TigerBeetle. Postgres holds all domain data (accounts, GL transactions, splits); **TigerBeetle holds the immutable postings** — consistent with the F18 principle that TB and Postgres are never conflated and TB is fully **hidden from the UI**. Splits sum to zero (balanced or rejected). Multi-currency transactions use **trading accounts** (one per currency pair), following GnuCash's model. Corrections are **reversing entries**, never edits. The chart of accounts is **entity-scoped** (F42) so each legal/family entity has its own books. Financial-statement placement (balance sheet vs P&L) is driven by account type. The Agent may **propose** entries but never auto-commits financial/asset creation. **Kanzen never moves money.**

---

## 1. Purpose & user value

Give the Principal a proper set of books for the household — a hierarchical chart of accounts, a general ledger of balanced transactions, and the ability to view an accurate balance sheet and P&L per entity. Every financial input that flows through Kanzen (bank transactions from F12/F14, receipts from F13, asset acquisitions at cost from F04/F20, liabilities from F41, investments from F40, expenses from F17) feeds the general ledger as a balanced split transaction. The result: a single, internally consistent financial picture per entity, backed by immutable double-entry postings in TigerBeetle, that the Principal (and their accountant) can interrogate without resorting to spreadsheets.

---

## 2. Roles & permissions

Resources `accounts`, `gl_transactions`, `gl_splits` — **Principal-private** (F02):

| Resource | Toby (Principal) | Lorna (Manager) | Marcia / Siti (Staff) | The Agent |
|---|---|---|---|---|
| `accounts` (balance-sheet types: `asset`, `bank`, `cash`, `security`, `receivable`, `liability`, `credit`, `equity`, `trading`) | `admin` | **none** — balance-sheet and equity accounts are Principal-private; field-stripped on every response | `none` | `propose` only (via F27) |
| `accounts` (income/expense types only: `income`, `expense`) | `admin` | `read` (register view, filtered to income/expense accounts) + `write` on expense lines they originate | `none` | `propose` only |
| `gl_transactions` / `gl_splits` (income/expense) | `admin` | `read` (their operational register) | `none` | `propose` only |
| `gl_transactions` / `gl_splits` (all other types) | `admin` | `none` | `none` | `propose` only |

Default-deny. The Manager carve-out covers income/expense **registers only** — never the balance sheet, equity, or valuation accounts. Entity scope applies: a Manager granted access to property A cannot see entity B's accounts. Field-level filtering strips balance-sheet amounts from any response a Manager can reach.

---

## 3. Data model

`V__accounting_core.sql` (migration after F42 and F18):

**`accounts`** — the chart of accounts.
```
id                  uuid        pk default gen_random_uuid()
owner_id            uuid        not null → users
entity_id           uuid        not null → entities (F42)  -- each entity has its own books
parent_id           uuid        null     → accounts        -- hierarchical; null = root
type                text        not null  -- 'asset'|'bank'|'cash'|'security'|'receivable'
                                          -- |'liability'|'credit'
                                          -- |'income'|'expense'
                                          -- |'equity'|'trading'
name                text        not null
code                text        null      -- user-defined account code (e.g. "1100")
currency            text        not null  -- ISO 4217; per-account currency
placeholder         bool        not null default false  -- cannot hold splits when true
status              text        not null default 'active'  -- 'active'|'hidden'|'closed'
description         text        null
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
deleted_at          timestamptz null      -- soft delete
```
Indexes: `accounts(entity_id)`, `accounts(parent_id)`, `accounts(type)`, unique `(entity_id, code)` where code is not null.

**`gl_transactions`** — a balanced event with ≥2 splits.
```
id                  uuid        pk default gen_random_uuid()
owner_id            uuid        not null → users
entity_id           uuid        not null → entities (F42)
txn_date            date        not null  -- the accounting date (not necessarily wall-clock)
description         text        not null
notes               text        null
source_type         text        null      -- 'bank_transaction'|'receipt'|'expense'|
                                          -- 'asset_acquisition'|'valuation'|'manual'|…
source_id           uuid        null      -- FK to the originating domain object
period_id           uuid        null      -- → accounting_periods (F42); null = open period
voided_at           timestamptz null      -- set when reversed; never deleted
voided_by_txn_id    uuid        null      → gl_transactions  -- the reversing entry
created_by          uuid        not null → users
created_at          timestamptz not null default now()
updated_at          timestamptz not null default now()
deleted_at          timestamptz null      -- soft delete (UI; immutable in TB)
```
Constraint: a transaction may not be voided and also have splits added; voiding creates a new reversing transaction.

**`gl_splits`** — one leg of a transaction.
```
id                  uuid        pk default gen_random_uuid()
transaction_id      uuid        not null → gl_transactions
account_id          uuid        not null → accounts
amount_minor        bigint      not null  -- integer minor units; negative = credit side
currency            text        not null  -- ISO 4217; must match account.currency
memo                text        null
reconcile_state     text        not null default 'unreconciled'
                                          -- 'unreconciled'|'cleared'|'reconciled'
lot_id              uuid        null      -- → lots (F40); for investment cost-basis tracking
tb_transfer_id      text        null      -- TigerBeetle transfer ID; set after posting
created_at          timestamptz not null default now()
```
Constraint: for a given `transaction_id`, `SUM(amount_minor)` **per currency** must equal zero — enforced at the application layer before any TB transfer is created; a split set that does not balance is **rejected** (HTTP 422). Multi-currency transactions achieve balance via **trading account splits** (one debit in the source currency + one credit in the target currency per the actual exchange rate; a corresponding pair in the trading account).

**`account_balances`** (materialised view or cache) — running balances derived from `gl_splits`; refreshed on each committed transaction. Serves the register and balance-sheet endpoints without a full scan.

All amounts: integer minor units + ISO currency, never float. All tables: `owner_id` on every row; `timestamptz`; soft-delete via `deleted_at`; all writes to audited tables.

---

## 4. API (Tapir endpoints)

All routes under `/api/accounting`. Auth = Cognito JWT → `Principal` (F01). `Authorizer` (F02) enforces account-type and entity scope on every call.

**Chart of accounts**
- `GET  /api/accounting/entities/:eid/accounts` — full tree (filtered by caller's account-type permission and entity scope). Query params: `?type=`, `?status=`, `?q=`.
- `GET  /api/accounting/entities/:eid/accounts/:id` — single account with balance summary.
- `POST /api/accounting/entities/:eid/accounts` — create (Principal only).
- `PATCH /api/accounting/entities/:eid/accounts/:id` — rename, recode, close, toggle placeholder (Principal only; cannot change `type` after splits exist).
- `DELETE /api/accounting/entities/:eid/accounts/:id` — soft-delete; rejected if splits reference the account.

**General ledger transactions**
- `GET  /api/accounting/entities/:eid/transactions` — paginated register. Query: `?account=`, `?period=`, `?from=`, `?to=`, `?source_type=`.
- `GET  /api/accounting/entities/:eid/transactions/:id` — single transaction + splits.
- `POST /api/accounting/entities/:eid/transactions` — create a balanced transaction (splits validated to sum zero; TB posting triggered post-commit). Body: `{txnDate, description, splits: [{accountId, amountMinor, currency, memo}], sourceType?, sourceId?}`.
- `POST /api/accounting/entities/:eid/transactions/:id/reverse` — create a reversing entry (Principal only). Body: `{txnDate, description}`. Sets `voided_at` on the original and returns the new reversing transaction.

**Financial statements**
- `GET /api/accounting/entities/:eid/statements/balance-sheet?as_of=` — assets / liabilities / equity → net worth. Principal-gated.
- `GET /api/accounting/entities/:eid/statements/profit-loss?from=&to=` — income / expenses → net income. Manager read-only on income/expense section.

**Registers**
- `GET /api/accounting/entities/:eid/accounts/:id/register` — date-ordered splits with running balance. Manager can call this for income/expense accounts only.

All endpoints return OpenAPI-documented Tapir responses. Errors: 400 (unbalanced splits), 403 (authz), 404, 409 (period closed), 422 (placeholder account, type-change blocked, currency mismatch).

---

## 5. UI / screens & states

The accounting UI surfaces under **Finance → Books** (or a dedicated **Accounting** section, TBD in F42):

**Chart of accounts screen**
- Hierarchical tree view with expand/collapse per type group (Assets / Liabilities / Equity / Income / Expenses).
- Each row: account code (if set), account name, currency, balance (Principal only), type pill, status badge.
- Actions: **New account** (Principal), **Edit / Close / Delete**.
- States: loading skeleton, empty (no accounts — prompt to set up), error, forbidden (Manager sees income/expense rows only; balance-sheet rows are absent, not redacted).

**Account register screen**
- Date-ordered split list with columns: date, description, memo, debit, credit, balance.
- Filter: date range, reconcile state.
- Inline **New transaction** (Principal); Manager on income/expense accounts.
- States: loading, empty, error, forbidden.

**New/edit transaction modal**
- Date picker, description, ≥2 split rows (account picker, amount, currency, memo).
- Live balance indicator ("splits balance: ✓ £0.00" / "⚠ unbalanced by £X").
- On submit: validates zero-balance; posts to API; on success shows audit trail entry.
- States: clean, dirty, unbalanced (inline error, submit blocked), saving, saved, error.
- **Agent-proposed transactions** render in Triage (F26) as a proposed transaction with all splits pre-filled; Toby must confirm — never auto-posted.

**Financial statements**
- Balance sheet (as-of date picker): Assets tree / Liabilities tree / Equity section → Net worth. Principal-only.
- P&L (date range): Income section / Expenses section → Net income. Manager sees this view filtered to income/expense types.
- Export to CSV/PDF via F30.

**TigerBeetle is never shown.** No `tb_transfer_id`, no TB account ID, no raw posting appears anywhere in the UI. Accounts, transactions, splits and balances are the user-visible model.

All screens: light + dark (StyleX tokens/themes); loading / empty / error / forbidden states per F00 component library.

---

## 6. Business rules & validation

**Balanced double-entry (hardest invariant)**
- A transaction is only committed if its splits sum to zero per currency. An attempt to save an unbalanced transaction returns HTTP 422 with a per-currency imbalance breakdown. No partial writes.
- The TB posting is triggered only after the Postgres transaction commits. If TB is unavailable, the domain write succeeds and the posting is queued (F18 resilience pattern).

**Multi-currency transactions via trading accounts**
- When a transaction spans two currencies (e.g. converting GBP to SGD), two trading-account splits are added automatically: one in the source currency and one in the target currency. The trading account absorbs the FX gain/loss, following GnuCash's model. F37 supplies the actual rate; the trading account balance represents net FX gain/loss per currency pair.
- Splits within a single currency always balance within that currency before trading accounts are considered.

**Account type rules**
- Account type is immutable after any split references the account.
- Placeholder accounts (`placeholder=true`) cannot receive splits — any attempt returns 422.
- Closed accounts (`status='closed'`) cannot receive new splits.
- Account type determines financial-statement placement: `asset`/`bank`/`cash`/`security`/`receivable` → balance-sheet assets; `liability`/`credit` → balance-sheet liabilities; `equity`/`trading` → equity/other; `income` → P&L income; `expense` → P&L expenses.

**Period control (F42)**
- A transaction cannot post into a **closed period** (F42 `accounting_periods`). Attempting to do so returns HTTP 409. A transaction with `period_id=null` posts to the open/current period.

**Immutable postings — corrections by reversal**
- Once committed, a GL transaction is never edited. To correct it, the caller invokes `POST /:id/reverse`, which creates an equal-and-opposite reversing transaction and sets `voided_at` on the original. Both remain queryable. TB transfer IDs in `gl_splits.tb_transfer_id` are never re-used or overwritten.

**Source traceability**
- `source_type` / `source_id` on `gl_transactions` links every posting back to its originating domain object (bank transaction, receipt, asset acquisition, etc.). This enables reconciliation (F14) to verify that every confirmed match has a corresponding GL posting.

**Inputs to the books**
- Registry assets at cost/valuation (F04 + F20) → asset account debit + cash/liability credit.
- Reconciled bank transactions/expenses (F12/F13/F14/F17) → income or expense splits.
- Investments (F40) → security account splits + trading accounts for currency effects.
- Liabilities (F41) → liability account entries.
- Reconciliation adjustments (F14) → adjustment transactions.
- All flows pass through the same `POST /api/accounting/entities/:eid/transactions` path or are system-generated on confirmed domain events.

**The Agent**
- Proposes transactions via F27/F26 (Triage); never auto-commits. A proposed transaction appears in Triage with a "Post to books" confirm action for Toby.

---

## 7. Integrations / external systems

| Dependency | Role |
|---|---|
| **F42 — Entities/books** | Provides `entity_id` scope; accounting periods (closed-period guard); entity CRUD is the prerequisite for chart-of-accounts setup |
| **F18 — TigerBeetle** | The immutable posting engine. Every committed GL transaction maps splits to TB transfers via `ledger_posting_groups` / `ledger_posting_references`. F39 calls F18's `postGroup` after each Postgres commit. TB is read for derived balances used in `account_balances` |
| **F37 — Currencies/FX** | Supplies daily FX rate at transaction date for multi-currency splits and trading-account amounts. Rate is captured at posting time and stored with the split |
| **F14 — Reconciliation** | Confirmed reconciliation matches trigger GL postings via `source_type='bank_transaction'`; F39 exposes a `source_id` lookup so F14 can verify every match has a corresponding posted transaction |
| **F04 / F20** | Asset acquisitions at cost and valuation snapshots → asset account debits. F39 listens for confirmed acquisition/valuation events and generates the corresponding GL entries |
| **F12 / F13 / F17** | Bank transactions, receipts and approved expenses → income/expense account splits |
| **F40 / F41** | Investments and liabilities → security/liability account entries (F39 provides the account types and split model; F40/F41 provide the domain events) |
| **F30 — Backup/restore** | Financial statements and GL transaction history included in the backup manifest; full replay of GL from TB transfer history |
| **F26 / F27** | Agent proposes transactions via Triage; F27 trust rules govern which proposals are surfaced |

No external third-party systems. Rates from F37, postings to F18, entity context from F42.

---

## 8. Edge cases

- **Unbalanced transaction attempt** — splits do not sum to zero: HTTP 422 with per-currency imbalance detail; no Postgres row written, no TB transfer created.
- **Multi-currency split via trading accounts** — a GBP→SGD exchange: debit bank:GBP / credit bank:SGD / debit trading:GBP / credit trading:SGD at the actual rate (F37); the transaction balances per currency via the trading account pair.
- **Posting into a closed period (F42)** — `txn_date` falls inside a closed `accounting_period`: HTTP 409 ("Period closed; use a later date or open the period"); no partial write.
- **Placeholder account receives a split** — HTTP 422 ("Account is a placeholder; it cannot hold postings; use a child account").
- **Type change after splits exist** — PATCH to change `type` blocked with 409 ("Account type is immutable after transactions exist").
- **Reversing correction preserves history** — original transaction is marked `voided_at`; both original and reversal queryable; GL register shows both with the voided one clearly marked; net balance effect is zero.
- **TB unavailable at posting time** — domain write succeeds (Postgres transaction committed); the split row exists with `tb_transfer_id=null`; posting is queued in F18's resilience buffer; when TB recovers the queue is flushed and `tb_transfer_id` is back-filled; unposted depth metric exposed.
- **Soft-deleted account referenced by existing splits** — soft-delete blocked (409) if any non-voided `gl_splits` reference the account.
- **Hierarchical account deletion** — parent account with active children cannot be deleted; children must be moved or deleted first.
- **FX gain/loss in trading account** — multiple currency conversions accumulate in the trading account; the balance represents unrealised FX gain/loss, visible to the Principal only in the balance sheet.
- **Agent-proposed transaction not confirmed** — the proposed entry sits in Triage (F26) indefinitely; no GL row or TB transfer is ever created until Toby explicitly confirms.

---

## 9. Acceptance scenarios (UAT)

Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Create chart of accounts and verify hierarchical structure**  ‹maps: `ChartOfAccountsIT`, web `accounting.spec` chart-of-accounts›
- **Given** Toby has an entity set up (F42) with no accounts
- **When** he creates a parent account `Assets` (type=`asset`, placeholder=true) and child accounts `Coutts Current` (type=`bank`, currency=GBP) and `Revolut SGD` (type=`bank`, currency=SGD)
- **Then** `GET /api/accounting/entities/:eid/accounts` returns the three accounts in a tree; `Assets` has two children; the placeholder flag is set on the parent
- **And** both child accounts are returned with a zero balance and are not themselves placeholder.

**AC2 — Balanced transaction commits and posts to TigerBeetle**  ‹maps: `BalancedTransactionIT`, `TbPostingAfterCommitIT`›  *(invariant: balanced double-entry; TB ledger hidden in UI)*
- **Given** Toby has `Coutts Current` (bank, GBP) and `Groceries` (expense, GBP) accounts
- **When** he posts a transaction `{txnDate: "2026-01-15", description: "Waitrose shop", splits: [{account: Coutts, amountMinor: -4500}, {account: Groceries, amountMinor: 4500}]}`
- **Then** the transaction is committed; both `gl_splits` rows exist; `SUM(amount_minor)` for the transaction is 0
- **And** a TB transfer is created via F18 (`tb_transfer_id` is populated in `gl_splits`); the raw TB transfer ID is **never** returned in any API response or rendered in any UI screen.

**AC3 — Unbalanced transaction is rejected**  ‹maps: `UnbalancedTransactionRejectedSpec`, `UnbalancedTransactionRejectedIT`›  *(invariant: imbalance rejected — no partial write)*
- **Given** Toby has `Coutts Current` and `Groceries` accounts
- **When** he attempts to post a transaction whose splits sum to £10 (not zero)
- **Then** the API returns **HTTP 422** with a body indicating the per-currency imbalance (e.g. `{currency: "GBP", imbalanceMinor: 1000}`)
- **And** no `gl_transactions` or `gl_splits` row is written; no TB transfer is created.

**AC4 — Reversal correction preserves history and net-zeros the ledger**  ‹maps: `ReversalCorrectionIT`, web `accounting.spec` register-reversal›  *(invariant: immutable postings — reverse, never edit)*
- **Given** a committed GL transaction (Waitrose £45) exists with TB transfer IDs populated
- **When** Toby calls `POST /api/accounting/entities/:eid/transactions/:id/reverse` with a correction date
- **Then** a new reversing transaction is created with equal-and-opposite splits; the original transaction's `voided_at` is set; neither transaction is deleted or mutated
- **And** the account register shows **both** the original (marked voided) and the reversal; the account balance reflects the net-zero effect; an audit entry is created for the reversal.

**AC5 — Posting into a closed period is blocked**  ‹maps: `ClosedPeriodBlockIT`›  *(invariant: closed-period guard via F42)*
- **Given** the 2025 accounting period for the entity is closed (F42)
- **When** Toby (or an automated source) attempts to post a transaction with `txnDate` in 2025
- **Then** the API returns **HTTP 409** ("Period closed")
- **And** no GL row is written; no TB transfer is created; the open period is suggested in the error body.

**AC6 — Placeholder account cannot hold splits**  ‹maps: `PlaceholderAccountRejectedIT`, web `accounting.spec` placeholder-guard›  *(invariant: placeholder accounts hold no postings)*
- **Given** `Assets` is a placeholder account
- **When** a transaction is submitted with a split referencing `Assets` directly
- **Then** the API returns **HTTP 422** ("Account is a placeholder; use a child account")
- **And** no transaction row or split is written.

**AC7 — Multi-currency transaction balances via trading accounts**  ‹maps: `MultiCurrencyTradingAccountIT`›
- **Given** Toby has `Coutts GBP` (bank, GBP), `Revolut SGD` (bank, SGD), and a `Trading:GBP/SGD` (trading) account
- **When** he records a GBP→SGD conversion using the F37 rate for that date (splits: debit GBP bank, credit SGD bank, debit trading:GBP, credit trading:SGD)
- **Then** the transaction balances to zero per currency (GBP splits sum to 0; SGD splits sum to 0); all four splits are committed
- **And** the trading account balance accumulates the FX gain/loss; no TB transfer uses raw rate arithmetic outside the split model.

**AC8 — Manager can read income/expense register; cannot read balance-sheet accounts**  ‹maps: `AccountingManagerScopeIT`, web `accounting.spec` manager-forbidden›  *(invariant: account-type and entity scope; no leak)*
- **Given** Lorna (Manager) and an entity with both bank (asset) and expense accounts
- **When** Lorna calls `GET /api/accounting/entities/:eid/accounts`
- **Then** she receives **only** the income/expense accounts; bank, asset, liability, equity and trading accounts are **absent** (not stripped — absent from the response set)
- **And** when she calls `GET /api/accounting/entities/:eid/accounts/:id/register` on the bank account, she receives **403**; on the expense account she receives the register with no balance-sheet figures exposed.

**AC9 — Agent-proposed transaction requires Toby's confirmation; never auto-posts**  ‹maps: `AgentProposedTransactionIT`, web `triage.spec` accounting-propose›  *(invariant: financial/asset creation proposed, never auto-committed — F27)*
- **Given** the email agent (F25) classifies an incoming invoice as a deductible expense and proposes a GL transaction
- **When** the agent runs
- **Then** the proposed transaction appears in Triage (F26) with status `proposed`; no `gl_transactions` row is created; no TB transfer is issued
- **And** only when Toby clicks **Post to books** does the GL row commit and the TB posting fire; if he dismisses it, no entry is ever created.

---

## 10. Test plan

**Backend (weaver + Testcontainers — Postgres 16 + TigerBeetle test container)**
- `ChartOfAccountsSpec` (FreeSpec): account type taxonomy, hierarchical parent/child, placeholder guard, type-immutability after splits, soft-delete guards.
- `BalancedTransactionSpec` (FreeSpec): zero-sum invariant across single-currency, multi-currency via trading accounts, mixed-sign splits, edge amounts (zero, negative).
- `UnbalancedTransactionRejectedSpec` (FreeSpec): rejects with per-currency imbalance; no side-effects.
- `ReversalCorrectionSpec` (FreeSpec): reversal creates equal-and-opposite; original `voided_at` set; net balance zero.
- Integration tests (weaver + Testcontainers):
  - `ChartOfAccountsIT` — round-trip create/read/update/soft-delete accounts; hierarchy query.
  - `BalancedTransactionIT` + `TbPostingAfterCommitIT` — full end-to-end: Postgres commit → TB transfer created; `tb_transfer_id` back-populated; idempotency (re-trigger does not double-post).
  - `UnbalancedTransactionRejectedIT` — HTTP 422, zero DB side-effects confirmed.
  - `ReversalCorrectionIT` — both original and reversal queryable; audit log entries present.
  - `ClosedPeriodBlockIT` — mock F42 closed period; HTTP 409.
  - `PlaceholderAccountRejectedIT` — HTTP 422 with correct message.
  - `MultiCurrencyTradingAccountIT` — four-split transaction; per-currency balance zero; trading account accrues.
  - `AccountingManagerScopeIT` — account list filtered to income/expense; balance-sheet 403.
  - `AgentProposedTransactionIT` — no GL row before confirmation; GL row + TB transfer after.
  - `TbLedgerHiddenIT` — assert no `tb_transfer_id`, TB account ID, or raw posting appears in any public API response body.

**Web (Vitest + Playwright)**
- Vitest: chart-of-accounts tree component (expand/collapse, placeholder badge, forbidden state); transaction form (live balance indicator, unbalanced inline error, multi-currency split rows); register (voided row styling, running balance).
- Playwright `accounting.spec`: create chart of accounts → post balanced transaction → view register → reverse → confirm reversal in register. Manager session: income/expense register accessible; bank account register returns 403. Unbalanced transaction blocked in form before submit. Agent-proposed transaction flow (confirm → posts; dismiss → absent).
- Axe a11y: chart-of-accounts tree, register table, transaction modal.

---

## 11. Observability & audit

**Audit events** (via `AuditWriter` → `audit_log_entries`): account create/update/close/delete; GL transaction create/reverse; period-guard rejection; proposed-transaction confirm/dismiss. All events carry `entity_id`, `owner_id`, `principal_id`, `action`, `target_id`, `diff`, `created_at`.

**Metrics (Prometheus)**
- `kanzen_gl_transactions_total{entity, type}` — transactions created per entity and source type.
- `kanzen_gl_imbalance_rejections_total{entity}` — unbalanced attempts rejected.
- `kanzen_gl_tb_posting_lag_seconds` — time from Postgres commit to TB transfer confirmed.
- `kanzen_gl_unposted_queue_depth` — splits with `tb_transfer_id=null` (TB resilience queue depth; F18).
- `kanzen_gl_closed_period_rejections_total` — closed-period guard hits.
- `kanzen_gl_reversals_total` — correcting reversals issued.

**Tracing**: OpenTelemetry spans on the transaction commit path and the TB posting call. The TB posting span is labelled `internal` and never surfaced in user-visible traces or UI.

---

## 12. Open questions / decisions

1. **F42 dependency ordering** — F39 depends on F42 (entities/books) for `entity_id` scoping and accounting periods. If F42 lands after F39 in the build queue, F39's entity scope should be stubbed with a single default entity until F42 is available.
2. **Account hierarchy depth** — GnuCash supports arbitrary depth. Should Kanzen impose a maximum depth (e.g. 5 levels) for display/performance reasons, or allow unlimited nesting?
3. **System-generated vs user-initiated accounts** — should onboarding auto-create a canonical chart of accounts (mirroring a UK/SG family-office standard) per entity, or require the Principal to build it from scratch?
4. **Lot tracking for investments (F40)** — `gl_splits.lot_id` is reserved for cost-basis tracking (FIFO/LIFO/average cost). The full lot model is F40's domain; F39 merely reserves the column.
5. **Balance-sheet report format** — present as a flat type-grouped list or a fully collapsible hierarchical tree that mirrors the chart of accounts? (Lean: hierarchical tree, matches the account screen.)
6. **Trading account automation** — should the API auto-insert the trading-account splits when a multi-currency transaction is detected, or require the caller to supply all four splits explicitly? (Lean: explicit for correctness; helper endpoint to compute the trading splits given two currency amounts and the F37 rate.)
7. **Manager income/expense register** — should a Manager be able to post expense transactions directly (e.g. enter a bill), or only read the register? (Lean: read-only register for Manager; writes via F15/F17 approval flow which calls the same GL posting path with Principal privilege.)
