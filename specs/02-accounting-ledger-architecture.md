# Kanzen — Accounting & Ledger Architecture (ADR-001)

**Status:** Accepted. **Supersedes the TigerBeetle-ledger approach.** This is the authoritative design for the double-entry general ledger that the finance (Wave C) and Private Wealth (Wave G) features build on. Where a feature spec disagrees, this wins; specs are being reconciled to it.

## Decision: the general ledger lives in PostgreSQL (TigerBeetle dropped)
TigerBeetle is built for **high-throughput exchange/payment ledgers**: single-commodity accounts, strictly **pairwise** transfers, immutable, no hierarchy, no rich queries. A family-office, GnuCash-grade GL is the opposite — **low volume, multi-currency, hierarchical, report-heavy, richly queried**. *We're not running an exchange.*

So the GL is **Postgres double-entry**, and it is the **single source of truth**. This:
- removes the **dual source of truth** for balances (previously F39 derived from Postgres, F18 from TB — a contradiction),
- removes the **dual-write/consistency problem** (no outbox, no Postgres↔TB reconciliation),
- gives ACID multi-split transactions, **exact `numeric`**, and joins for statements — the natural shape (GnuCash itself is a relational double-entry engine).

High-performance ledger tech is reserved for if Kanzen ever needs exchange-grade throughput. It doesn't.

## The double-entry model (GnuCash, modernised)
- **Account** — typed, hierarchical (`parent_id`), **entity-scoped (F42)**, denominated in a single **commodity** (a currency *or* a security).
- **Transaction** — a dated event with **≥2 splits** that balance, in an accounting period (F42).
- **Split** — belongs to (transaction, account); carries:
  - **`amount`** — in the **account's commodity** (`numeric`, exact; scale per commodity).
  - **`value`** — in the **transaction's currency** (integer **minor units**), `= amount × rate`.
  - A transaction **balances when `SUM(value) = 0`** across its splits.
  - This is GnuCash's **value/amount duality**: one transaction can touch accounts in different commodities (a GBP bank account ↔ a USD security) and still balance — no trading account needed for the common case.
- **Multi-currency** — handled by value/amount directly. **Trading accounts** (per-commodity) are supported optionally for strict per-commodity double-entry (GnuCash "Use Trading Accounts" mode). FX gain/loss is recognised on cross-currency settlement (see cookbook).
- **Immutability & corrections** — posted transactions are immutable; a correction is a **reversing transaction + re-post** (history preserved, audited). Never edit a posted entry.
- **Reconciliation state** per split — `n` new / `c` cleared / `y` reconciled (drives F14 + statement reconcile).
- **Closed periods** (F42) reject new postings (HTTP 409).

## Commodities & precision (no floats, ever)
- **`commodities`** — `id, kind ('currency'|'security'|'crypto'), code (ISO-4217 / ticker / ISIN), name, scale int`. `scale` = decimal places of the smallest unit: GBP 2, JPY 0, BHD 3, **BTC 8**, equities 0–6, fund units e.g. 4.
- **`split.amount`** = `numeric` (exact) in the commodity's units; **`split.value`** and all "money" = **integer minor units of a currency**. **Prices** (F40) = `numeric` per unit. Resolves the "minor units don't fit securities/crypto" gap: money stays integer-exact; commodity quantities are exact `numeric`.
- **Rounding** — conversions round half-up to target scale; the rounding residual of a balanced multi-currency transaction posts to a **`Rounding`/`FX` account** so the books always sum to zero.

## Source of truth & balances
- **`gl_splits` ARE the ledger.** Balances derive from splits via a materialised **`account_balances`** cache, refreshed **in the same ACID transaction** as the posting. Exactly one balance authority; no external ledger.

## Posting cookbook (canonical double-entry per event)
Every economic event posts a fixed recipe (entity-scoped; native commodity + value in txn currency). Building a finance/wealth slice = "wire event → this recipe", not re-inventing entries.

| Event | Entries (Dr / Cr) |
|---|---|
| Opening balance | Dr/Cr the account ↔ `Equity:Opening Balances` |
| Expense (cash/card) | Dr `Expense:<cat>` · Cr `Bank/Card` |
| Income | Dr `Bank` · Cr `Income:<salary|dividend|rental|interest>` |
| Transfer (own accounts) | Dr `Account B` · Cr `Account A` (no income/expense; F14 transfer detection) |
| Asset acquisition (F04/F13) | Dr `Asset:Registry` (at cost) · Cr `Bank/Card` |
| Associated cost (F17) | Dr `Expense:Service` · Cr `Bank` (feeds asset lifetime cost) |
| Refund | Dr `Bank` · Cr `Expense:<cat>` (reverses original) |
| FX settlement gain/loss | value diff ↔ `Income/Expense:FX Gain/Loss` |
| Security **buy** (F40) | Dr `Asset:Security` (amount = shares @ price; value = cost) · Cr `Bank`; fees Dr `Expense:Fees` · Cr `Bank` |
| Security **sell** (F40) | Cr `Asset:Security` (lot closed, amount = shares) · Dr `Bank` (proceeds); realised gain (proceeds − basis) ↔ `Income:Capital Gains` |
| Dividend / distribution | Dr `Bank` · Cr `Income:Dividends` (DRIP = dividend then buy) |
| Stock split | quantity-only adjust of the security `amount` + lots, **unchanged basis** (no value change) |
| Merger / spin-off | close old lots, open new at carried basis (value-preserving); cash component → `Bank` |
| Return of capital | Cr `Asset:Security` (reduces basis) · Dr `Bank` |
| Liability drawdown / repayment (F41) | drawdown: Dr `Bank` · Cr `Liability`; repayment: Dr `Liability` (principal) + Dr `Expense:Interest` · Cr `Bank` |
| Valuation change (F20, illiquid/market) | **NOT a GL posting** — a price/valuation snapshot; unrealised, surfaces in net worth (F41) + reports (F43) only |

**Realised only:** unrealised gains (investments at market, illiquid assets at valuation) are **reporting overlays** (F41/F43), never posted. Only realised events hit the books — keeps the GL clean (matches GnuCash practice).

## Impact on specs (reconciliation)
- **F18** → repurposed: **"General Ledger (Postgres double-entry)"** — the engine (accounts/transactions/splits/balances/posting service + this cookbook). (Was "TigerBeetle ledger".)
- **F39** → chart-of-accounts management + transaction entry on the F18 engine; balances from `gl_splits`; TB references removed.
- **F40/F41/F43** → post via the cookbook; the **"ledger hidden in the UI"** invariant stands (now the Postgres GL — statements/registers shown, raw postings never).
- **F00** → drops the TigerBeetle client/boot-step/stack entry.
- **F37** → unchanged; `fx_rates` feed `split.value`.
- **CLAUDE.md / plan** → stack drops TigerBeetle; the invariant reads "the **general ledger** is hidden in the UI".
