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

## 9. Acceptance criteria
- **AC1** A transaction auto-suggests its receipt match with a confidence; confirming sets both to `matched`.
- **AC2** One receipt reconciles against two installment transactions (1:N, partial allocations summing correctly).
- **AC3** A transfer between own accounts is detected and excluded from spend.
- **AC4** A refund reverses a prior match without mutating history (superseded chain).
- **AC5** Manager can reconcile but sees no balances; Staff sees nothing.

## 10. Test plan
Backend (weaver+PG): cardinality + partial allocation math; transfer/refund detection; supersede-not-mutate; suggestion heuristics + threshold; currency. Web: Vitest reconciliation stream; Playwright suggest→confirm + a 1:N match.

## 11. Observability & audit
Audit: match create/confirm/reject/supersede, split, transfer/refund/ignore marks. Metrics: unmatched backlog, auto-suggest acceptance rate, time-to-reconcile, transfer/refund counts.

## 12. Open questions
1. Suggestion model depth — heuristic only vs add embeddings/Claude fuzzy matching. 2. Auto-match confidence threshold (financial → conservative). 3. Amount/date tolerance defaults.
