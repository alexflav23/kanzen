# Feature F16 — Payment methods & Pay queue

| | |
|---|---|
| **Feature ID** | F16 |
| **Milestone** | M3 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F15 (bills), F12/F14 (transactions/reconcile); F09 (1Password reference) |
| **Spec references** | SPEC §9.7; `input/views/finance.jsx → PayQueue/PaymentMethods`, App. E.8 |

> **Decisions (revisitable):** a **`PaymentMethod`** wallet (display metadata only — **card numbers/credentials live in 1Password**); a **Pay queue** classifying due bills as **Auto** (DD/GIRO/card) · **Manual** ("Mark paid") · **Needs review** (variance/awaiting); a `BillPayment` lifecycle. **Kanzen never moves money** — "Mark paid" records reality, it does not pay.

## 1. Purpose & user value
A clear, forward view of what's due, how it'll be paid, and what needs a human — without Kanzen ever touching the money. Auto-paid bills show as scheduled; manual ones get marked paid; variances surface for review. Payment methods are a tidy, 1Password-backed wallet.

## 2. Roles & permissions
Resources `payment_method`, `bill_payment` (Manager operational, F02): **Principal** `admin`; **Manager** `write` on the pay queue (mark paid) + `read` payment-method display metadata (no full numbers — they're in 1Password anyway); **Staff** `none`.

## 3. Data model
`V__payments.sql`:
- **`payment_methods`** — `id, owner_id, type ('credit_card'|'bank_account'|'multi_currency'|'other'), display_name, holder, last4 text null, expiry text null, currency text, status ('active'|'inactive'), vault_ref text null (1Password name), note text null, used_for_count int derived, created_at, deleted_at`.
- **`bill_payments`** — `id, bill_id → bills, payment_method_id → payment_methods, due_date date, amount_minor bigint, currency, mode ('auto'|'manual'|'review'), state ('scheduled'|'settled'|'due'|'paid'|'resolved'|'ignored'), variance_flag bool, bank_transaction_id uuid null (F14, auto-detect paid), marked_paid_by uuid null, marked_paid_at null, created_at`.

## 4. API
- Payment methods: `GET/POST/PATCH/DELETE /api/payment-methods`.
- Pay queue: `GET /api/pay-queue?filter=all|review|auto|manual` · `POST /api/bill-payments/:id/mark-paid` · `POST /:id/review-resolve`.
- A scheduled job materialises upcoming `bill_payments` from the bill schedule (F15).

## 5. UI / screens & states
Per `finance.jsx` (App. E.8):
- **Pay queue**: 4 tiles (due next 30d GBP/SGD, auto-paid count, awaiting review); filter (All/Needs review/Auto/Manual); date-grouped rows — **Auto** → "Scheduled" chip; **Manual** → "Mark paid"; **variance** → "Review". 
- **Payment methods**: wallet tiles (type, holder, ··last4, expiry, currency, used-by); the **1Password note** ("card numbers live in 1Password"); Add method.
- States: scheduled, due, paid, needs-review, expired-card.

## 6. Business rules & validation
- **No money movement.** `auto` = the bank/DD/GIRO/card settles it; Kanzen shows "Scheduled" and (optionally) auto-confirms `settled` when reconciliation (F14) matches a transaction. `manual` = household pays externally, someone records **Mark paid** (`paid`). 
- **Review** = a variance-flagged or awaiting bill; resolving moves it on.
- **1Password**: store only display metadata + `vault_ref`; never PANs/credentials.
- **Auto-detect paid**: when a transaction reconciles to a bill (F14), the matching `bill_payment` can flip to `settled`/`paid`.

## 7. Integrations
F15 (bills → queue), F14 (reconcile → auto-mark paid), F09/1Password (vault reference). No PIS/payment API anywhere.

## 8. Edge cases
Card expiry (warn); auto bill that didn't actually settle (no matching transaction → flag); duplicate mark-paid; multi-currency totals; method used by many bills; method deleted while bills reference it (reassign).

## 9. Acceptance criteria
- **AC1** Due bills appear grouped by date, classified Auto/Manual/Review.
- **AC2** "Mark paid" records a manual payment (paid-by/at) without any money movement; no PIS endpoint exists.
- **AC3** A reconciled transaction auto-flips its bill payment to settled.
- **AC4** Payment-method tiles show only display metadata; full card data is only in 1Password.
- **AC5** An expiring card is flagged.

## 10. Test plan
Backend (weaver+PG): queue materialisation from bills; mark-paid lifecycle; auto-settle via reconciliation; no-PIS assertion; method-in-use guard. Web: Vitest pay queue + wallet; Playwright mark-paid + filter.

## 11. Observability & audit
Audit: payment-method CRUD, mark-paid, review-resolve, auto-settle. Metrics: due/paid/auto/review counts, overdue, card-expiry warnings.

## 12. Open questions
1. Auto-settle confidence (only on confident reconciliation match). 2. Whether Manager can edit payment methods or only view. 3. Reminders for manual bills due (ties to F11).
