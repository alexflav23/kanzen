# Feature F14 — Reconciliation engine

| | |
|---|---|
| **Feature ID** | F14 |
| **Milestone** | M3 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F12 (transactions), F13 (receipts); feeds F17 (expenses), F18 (ledger) |
| **Spec references** | SPEC §9.3; `input/views/inbox.jsx → ReconciliationStream`, App. E.3/E.8 |

> **Decisions (revisitable):** match **bank transactions ↔ receipts** with N:M support, partial payments, splits, refunds/reversals, **transfer detection**; **states** unmatched/suggested/matched/partially_matched/split/ignored/transfer/refund/superseded; suggestions carry **confidence** (amount+date+merchant proximity + rules; embeddings/Claude optional); **corrections are events, history never mutated**.

## 1. Purpose & user value
Tie the money that left the account to the evidence of what it bought — so spend is provable, assets trace to receipts, and the ledger is trustworthy. The unmatched/suggested queue lives in the Inbox; confirmations are one click.

## 2. Roles & permissions
Resource `reconciliation` (Manager operational, F02): **Principal** `admin`; **Manager** `read` transactions + receipts and `write` matches (runs reconciliation — §4) but no balances; **Staff** `none`.

## 3. Data model
`V__reconciliation.sql`:
- **`reconciliation_matches`** — `id, owner_id, state, confidence numeric null, note text null, created_by, created_at, superseded_by uuid null`.
- **`match_members`** — `match_id, member_type ('transaction'|'receipt'), member_id, amount_allocated_minor` (supports N:M + partial allocation).
- **`transaction_splits`** — `id, transaction_id → bank_transactions, amount_minor, category_id, note` (one transaction split into reconcilable parts).
- `bank_transactions.reconciliation_state` (F12) reflects the current state; the match is the record.

## 4. API
`GET /api/reconciliation?stream=needs|resolved` (Inbox) · `GET /api/reconciliation/suggestions` (auto-suggested matches + confidence) · `POST /api/reconciliation/matches` (link txn(s)↔receipt(s), with allocations) · `POST /:id/confirm` · `/reject` · `POST /api/transactions/:id/split` · `POST /api/transactions/:id/mark` (`transfer`/`refund`/`ignored`).

## 5. UI / screens & states
Per `ReconciliationStream` (App. E.3): **Needs attention** (suggested w/ confidence vs unmatched, Confirm/Review/Link/Ignore) + **Resolved (30d)** (state pills). A fuller reconciliation workspace for N:M/partial cases. States: suggested, unmatched, partially-matched, split, resolved, transfer/refund.

## 6. Business rules & validation
- **Match cardinality**: 1:1, 1:N, N:M; partial allocation sums must reconcile; overpayment/refund handled via `refund` linkage.
- **Transfer detection**: opposite amounts between the household's own accounts → `transfer` (excluded from spend, no double-count).
- **Suggestions**: heuristic proximity (amount tolerance, date window, merchant-name similarity) + rules (F27); embeddings/Claude optional for fuzzy merchant matching. Above a threshold → suggested (never silently committed for financial records, §10.3).
- **Corrections are events**: re-matching supersedes (`superseded_by`), never mutates prior matches; full history queryable.
- **Currency**: cross-currency matches explicit (e.g. Amex GBP vs SGD receipt) — no silent FX.

## 7. Integrations
F12 (transactions), F13 (receipts/line items), F27 (match rules), F18 (matched groups → ledger postings). No external systems.

## 8. Edge cases
Partial payment / installments (one receipt ↔ many transactions); a card statement line ↔ many receipts; refund reversing a prior match; transfer vs expense; duplicate suggestions; superseded chain; currency mismatch; pending transaction matched then re-booked.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Auto-suggested match confirmed by Manager**  ‹maps: `ReconciliationSuggestIT`, web `reconciliation.spec` suggest-confirm›
- **Given** a bank transaction and a confirmed receipt with matching merchant, amount, and date (within tolerance)
- **When** the suggestion engine runs
- **Then** a `reconciliation_matches` row is created with `state=suggested` and a `confidence` score; the Inbox shows the pair with a **Confirm** CTA
- **And** when Lorna confirms, both the transaction and receipt move to `state=matched`; the match is audited.

**AC2 — 1:N partial allocations sum correctly**  ‹maps: `PartialAllocationIT`›
- **Given** one receipt for £600 and two installment transactions of £300 each
- **When** Lorna links both transactions to the receipt with `amount_allocated_minor=300_00` each
- **Then** the match is created with `state=partially_matched` → `matched` when both are present; `match_members` allocations sum exactly to the receipt total
- **And** the engine rejects any allocation set that does not sum to the total (validation error).

**AC3 — Transfer between own accounts excluded from spend**  ‹maps: `TransferDetectionIT`›
- **Given** a debit transaction on Coutts and a matching credit on Revolut for the same amount and date
- **When** the transfer-detection pass runs
- **Then** both transactions are marked `internal_status=transfer` and excluded from spend aggregates
- **And** no income/expense posting is generated in the ledger (F18 invariant) — only a transfer posting.

**AC4 — Refund reverses prior match without mutation**  ‹maps: `RefundReversalIT`›
- **Given** a confirmed match between a transaction and receipt
- **When** a refund transaction arrives and Toby links it as a refund reversal
- **Then** the original match is set `superseded_by` the new reversal group; history shows **both** (original + reversal) with nothing deleted or mutated
- **And** the net spend effect is zero; prior match remains queryable.

**AC5 — Suggested match is never silently committed**  ‹maps: `ReconciliationProposedNotCommittedIT`›  *(invariant: financial records proposed-not-auto-committed)*
- **Given** a high-confidence auto-suggestion
- **When** the engine creates it
- **Then** its `state` is `suggested`, **never** `matched` without an explicit human confirm action
- **And** the Inbox presents the suggestion with Confirm/Reject; no match is finalised without a user action.

**AC6 — Manager reconciles; no balances; Staff denied**  ‹maps: `ReconciliationAuthzIT`›  *(invariant: server-side scope; no leak via totals)*
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** Lorna calls `GET /api/reconciliation?stream=needs` and `POST /api/reconciliation/matches`
- **Then** she receives the reconciliation queue (200) and can confirm matches; `financial_account.balance_minor` is **absent** from any account data returned
- **And** Marcia's request to any reconciliation endpoint returns **403** — no transaction, receipt, or total amount is revealed.

## 10. Test plan
Backend (weaver+PG): cardinality + partial allocation math; transfer/refund detection; supersede-not-mutate; suggestion heuristics + threshold; currency. Web: Vitest reconciliation stream; Playwright suggest→confirm + a 1:N match.

## 11. Observability & audit
Audit: match create/confirm/reject/supersede, split, transfer/refund/ignore marks. Metrics: unmatched backlog, auto-suggest acceptance rate, time-to-reconcile, transfer/refund counts.

## 12. Open questions
1. Suggestion model depth — heuristic only vs add embeddings/Claude fuzzy matching. 2. Auto-match confidence threshold (financial → conservative). 3. Amount/date tolerance defaults.
