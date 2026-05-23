# Feature F18 — TigerBeetle ledger

| | |
|---|---|
| **Feature ID** | F18 |
| **Milestone** | M4 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F14 (reconciliation), F17 (expenses/associated costs), F19 (acquisition); mirrors Hypervolt **athena** TigerBeetle integration |
| **Spec references** | SPEC §9.1, §9.4, §14; App. A (ledger entities) |

> **Decisions (revisitable):** immutable **double-entry postings in TigerBeetle**; **Postgres holds domain data, TB holds postings only** — never conflated; **ledger fully hidden in the UI** (internal truth, surfaced only via derived balances/Insights/backup); **corrections are reversing postings, never mutations**; mirror **athena's** TB client/compose/Terraform setup.

## 1. Purpose & user value
The rigorous, immutable financial spine beneath the friendly UI — every acquisition, service cost, refund, transfer and adjustment recorded as balanced double-entry postings that can never be silently altered. Invisible day-to-day, indispensable for trust, audit and catastrophic-loss recovery.

## 2. Roles & permissions
Resource `ledger` (Principal-private; **no UI**): **Principal** `read` (derived balances only); **Manager/Staff** `none`. Postings are written by the system, not users.

## 3. Data model
TigerBeetle holds **accounts + transfers**; Postgres holds the mapping + group metadata (`V__ledger.sql`):
- **`ledger_account_mappings`** — `id, owner_id, code, name, type ('asset'|'liability'|'equity'|'income'|'expense'), currency, tb_account_id`. A small **chart of accounts** (per currency).
- **`ledger_posting_groups`** — `id, owner_id, kind ('acquisition'|'refund'|'maintenance_cost'|'transfer'|'adjustment'), source_type, source_id, occurred_at, note, created_at`.
- **`ledger_posting_references`** — `id, group_id, tb_transfer_id, debit_account_id, credit_account_id, amount_minor, currency, created_at`. Maps domain → TB transfer IDs (idempotent).

## 4. API
Internal only: `postGroup(kind, source, entries)` (idempotent); `deriveBalance(account, asOf)`; `report(...)` for Insights (F29). **No user-facing postings endpoint/screen.**

## 5. UI / screens & states
**None** (hidden by design). Ledger truth surfaces only as **derived balances/totals in Insights (F29)** and in the **backup manifest (F30)**.

## 6. Business rules & validation
- **Double-entry**: every group balances (debits = credits) per currency.
- **What's in TB vs Postgres** (the deliberate line — "TB for all the transaction stuff" = the *postings*, not the records): **TigerBeetle holds the immutable double-entry postings + balances** (the money-movement truth); **Postgres holds the domain records** — bank transactions from GoCardless, receipts, reconciliation, merchants, descriptions, categories — which **reference** TB transfer IDs. TB is a specialised accounting engine, not a metadata store.
- **Postings generated from**: reconciled expense/transaction (F14/F17), asset **acquisition** (F19), **associated costs** (F17/§9.6), **refunds** (reversing), **transfers** (own-account, no income/expense), real **currency exchanges**, and **adjustments**.
- **Idempotency**: `(source_type, source_id, kind)` → at-most-once posting; re-sync never double-posts (TB transfer IDs deterministic).
- **Corrections**: a wrong posting is **reversed** (a balancing posting), never edited — full history preserved.
- **Multi-currency**: **one TB ledger per currency** (GBP, SGD, USD, …); postings stay in their **native** currency. Two distinct cases: **(a) a real currency exchange** (e.g. Revolut converting GBP→USD) is a genuine **inter-ledger transfer** in TB at the **actual** rate; **(b) unified-currency *reporting*** (viewing everything in GBP) is **not** a posting — it's F37's display overlay converting at each posting's transaction-date rate. So TB = native truth; F37 = the reporting lens on top.

## 7. Integrations / external systems
- **TigerBeetle** — mirror athena's client + `docker-compose` service + Terraform host (SETUP A10). 
- Consumes F14/F17/F19 events; feeds F29 Insights + F30 backup (replayable posting history).

## 8. Edge cases
- Re-reconciliation supersede → reversing + new posting. Refund after acquisition. Transfer mis-detected → adjustment. TB unavailable → queue postings + retry (domain write succeeds, posting eventually-consistent, flagged). Currency mismatch. Partial allocation across assets.

## 9. Acceptance criteria
- **AC1** A confirmed acquisition writes a balanced posting group (debit asset, credit cash/card) in the correct-currency TB ledger.
- **AC2** Re-running the same source produces no duplicate posting (idempotent).
- **AC3** A refund creates a reversing group; history shows both, nothing mutated.
- **AC4** A transfer between own accounts posts without income/expense impact.
- **AC5** Derived balances feed Insights; **no ledger UI exists**.
- **AC6** TB downtime queues postings and reconciles when back, without blocking domain writes.

## 10. Test plan
Backend (weaver + **TigerBeetle test container**): balanced double-entry, idempotency, reversing corrections, multi-currency ledgers, queue-on-TB-down, derive-balance correctness. Replay test for backup (F30).

## 11. Observability & audit
Audit: posting-group creation/reversal. Metrics: postings/day by kind, posting lag, TB health, balance-derivation latency, unposted-queue depth.

## 12. Open questions
1. **Chart of accounts** design (granularity per category/property/currency). 2. ~~Multi-currency TB ledger strategy~~ **resolved**: per-currency ledgers; real FX = inter-ledger transfer at the actual rate; reporting conversion via F37 (not a posting). 3. Whether acquisition postings are per-asset or per-receipt. 4. Mirror athena exactly vs Kanzen-specific account model.
