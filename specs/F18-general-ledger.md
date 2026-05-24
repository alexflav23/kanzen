# Feature F18 — General Ledger (Postgres double-entry engine)

| | |
|---|---|
| **Feature ID** | F18 |
| **Milestone** | Wave C (Finance) |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F42 (entities/books), F14 (reconciliation), F37 (FX); the **engine** for F39/F40/F41/F43, F17/F19 |
| **Spec references** | `02-accounting-ledger-architecture.md` (**ADR-001** — authoritative), GnuCash `Transaction`/`Split` |

> **Decisions:** the general ledger is **Postgres double-entry** (ADR-001) — **TigerBeetle dropped** (not an exchange; it forced a dual source of truth + dual-write). `gl_splits` **are** the ledger; balances derive from them **in the same ACID transaction** (one balance authority). Postings are **immutable**; corrections are **reversing transactions**, never edits. Multi-currency via GnuCash's **value/amount** model. Entity-scoped (F42). **Hidden from the UI** (statements/registers only).

## 1. Purpose & user value
The rigorous, immutable financial spine beneath the friendly UI: every acquisition, cost, refund, transfer, trade and adjustment is a **balanced transaction of splits** in Postgres. Balances and statements derive from it. Invisible day-to-day; indispensable for trust, audit and catastrophic-loss recovery. F39 (chart of accounts + entry) and the wealth features (F40/F41/F43) sit on this engine.

## 2. Roles & permissions
Resource `ledger` — **Principal-private; no raw-posting UI**. **Principal** `read` (via derived statements/registers in F39/F29). **Manager** `read` only on income/expense registers (F39 carve-out) — never balance-sheet/equity or raw postings. **Staff** `none`. Postings are written by the system's posting service, not by users; the Agent may **propose** (F27), never post.

## 3. Data model
`V__ledger.sql` (commodities + the posting tables; the `accounts` chart of accounts lives in F39):
- **`commodities`** — `id, kind ('currency'|'security'|'crypto'), code, name, scale int` (decimal places of the smallest unit: GBP 2, JPY 0, BTC 8, equities 0–6). Per ADR-001.
- **`gl_transactions`** — `id, owner_id, entity_id → entities (F42), txn_date date, currency text, description text, source_type text null, source_id uuid null, period_id → accounting_periods (F42), reversed_by uuid null → gl_transactions, created_at`. Immutable once posted.
- **`gl_splits`** — `id, transaction_id, account_id → accounts (F39), amount numeric not null (account commodity), value_minor bigint not null (txn currency, signed), rate numeric, reconcile_state text ('n'|'c'|'y') default 'n', memo text null, lot_id uuid null → investment_lots (F40)`. **Balance constraint: `SUM(value_minor) = 0` per `transaction_id`** (multi-currency balances on `value`; see ADR §multi-currency).
- **`account_balances`** — materialised cache (`account_id`, running/period balances) refreshed **in the posting transaction**. The sole balance source.

All money = integer **minor units**; commodity quantities = exact `numeric`; **no float**. `owner_id` on every row; `timestamptz`; all writes audited.

## 4. API (internal — no user-facing posting endpoint)
- **`post(entityId, transaction)`** — validates balance, writes `gl_transactions` + `gl_splits` + refreshes `account_balances` **in one Postgres transaction**; **idempotent** by `(source_type, source_id)`. Rejects unbalanced (422) and closed-period (409).
- **`reverse(transactionId)`** — posts the equal-and-opposite reversing transaction (history preserved).
- **`balance(accountId, asOf)` / `register(accountId)`** — derived reads (feed F39 registers, F29 insights, F43 statements).
- The **posting cookbook** (ADR-001) is the canonical recipe per event; callers (F17/F19/F40/F41) post via it.

## 5. UI / screens & states
**None** — hidden by design. The ledger surfaces only as **account registers + financial statements (F39/F43)**, **Insights aggregates (F29)**, and the **backup manifest (F30)**. Raw postings/IDs never appear.

## 6. Business rules & validation
- **Balanced or rejected**: `SUM(value_minor)=0` per transaction, enforced before commit (422 otherwise).
- **Atomic**: splits + balance update commit together in one Postgres transaction — no separate ledger, no queue, no eventual consistency.
- **Immutable + reversing corrections**: posted transactions are never edited; a correction is a reversing transaction (`reversed_by` chain), full history preserved.
- **Multi-currency**: a transaction may touch accounts in different commodities; it balances on `value` (GnuCash value/amount). The rounding residual of a balanced FX transaction posts to a `Rounding`/`FX` account (ADR-001). Trading accounts are an optional strict mode.
- **Closed periods** (F42) reject new postings (409).
- **Idempotent** by source key; re-processing a source never double-posts.
- **Realised only**: unrealised gains (market/valuation) are reporting overlays (F41/F43), never posted (ADR-001).

## 7. Integrations / external systems
**None external.** Consumed by F17 (expenses/associated costs), F19 (acquisition), F40 (buy/sell/dividend/corporate actions), F41 (liabilities); feeds F29 (insights), F43 (statements), F30 (backup — replayable history). FX rates from F37 supply `value`.

## 8. Edge cases
Unbalanced transaction → 422. Multi-currency rounding residual → Rounding/FX account. Reversing an already-reversed entry. Posting into a closed period → 409. Concurrent postings to one account (serialised; balance cache consistent). Very large split sets. Backdated transaction into an open prior period.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Balanced transaction posts atomically**  ‹maps: `GlPostBalancedIT`, web (none — hidden)›  *(invariant: balanced double-entry)*
- **Given** an acquisition for the Wardian entity (Dr `Asset:Registry` £42,000 · Cr `Bank` £42,000)
- **When** the posting service runs
- **Then** one `gl_transaction` + its `gl_splits` are written and `account_balances` updated **in a single Postgres transaction**
- **And** `SUM(value_minor)=0`; nothing partial can persist.

**AC2 — Unbalanced transaction is rejected**  ‹maps: `GlUnbalancedRejectedIT`›  *(invariant: balanced double-entry)*
- **Given** a transaction whose splits do not sum to zero
- **When** posting is attempted
- **Then** it is **rejected (422)** and no splits or balances are written.

**AC3 — Multi-currency transaction balances on value**  ‹maps: `GlMultiCurrencyIT`›
- **Given** £100 from a GBP bank account buys $130 of a USD-denominated holding
- **When** posted
- **Then** splits carry native `amount` + `value_minor` at the F37 rate, balance to zero on value, and any rounding residual posts to the `Rounding/FX` account.

**AC4 — Correction is a reversing transaction; original immutable**  ‹maps: `GlReversalIT`›  *(invariant: postings immutable — reverse, never edit)*
- **Given** a posted transaction later found wrong
- **When** Toby issues a correction
- **Then** a reversing transaction is posted (`reversed_by` set); the original is **unchanged**; both remain queryable.

**AC5 — Ledger is hidden; nothing raw reaches the UI**  ‹maps: `GlLedgerHiddenIT`, web `insights.spec`›  *(invariant: general ledger hidden in UI)*
- **Given** a funded ledger
- **When** any user opens any screen
- **Then** **no raw postings, splits, or account ids appear anywhere** — only derived registers/statements/insights.

**AC6 — Closed period rejects posting**  ‹maps: `GlClosedPeriodIT`›
- **Given** FY2024 is closed (F42)
- **When** a transaction dated in FY2024 is posted
- **Then** it is **rejected (409 PERIOD_CLOSED)**; no write occurs.

**AC7 — Manager/Staff cannot reach raw postings (negative)**  ‹maps: `GlAuthzIT`›  *(invariant: Principal-private; no leak)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either calls any ledger/balance endpoint
- **Then** balance-sheet/raw-posting access is **denied (403)**; only the income/expense register carve-out (F39) is visible to Lorna; no posting id or balance-sheet total leaks.

**AC8 — Idempotent posting by source key**  ‹maps: `GlIdempotencyIT`›
- **Given** a transaction already posted for `(source_type, source_id)`
- **When** the same source is processed again
- **Then** **no duplicate** transaction is created (returns the existing one).

## 10. Test plan
Backend (weaver + **Testcontainers-Postgres**): balance enforcement; atomic post (splits + balance in one tx); multi-currency value/rounding; reversing corrections; closed-period rejection; idempotency by source key; balance derivation correctness; replay for backup (F30, the catastrophic-recovery test). No web (hidden); the carve-out register is tested in F39.

## 11. Observability & audit
Audit: transaction post + reversal. Metrics: `gl_transactions_total` by entity/kind, unbalanced-rejected count, balance-derivation latency, postings/day.

## 12. Open questions / decisions
1. **Chart-of-accounts granularity** (per category/property/currency) — owned by F39.
2. **Trading accounts** default on/off (ADR-001 supports both; lean: value/amount by default, trading-accounts opt-in).
3. **Cash-flow derivation** — direct vs indirect from the GL (F43).
