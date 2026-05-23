# Feature F17 — Budgets, expenses & approvals

| | |
|---|---|
| **Feature ID** | F17 |
| **Milestone** | M3 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (property), F12/F13/F14 (transactions/receipts/reconcile), F04 (assets for associated costs), F16 (payment method) |
| **Spec references** | SPEC §9.5, §9.6; `input/views/finance.jsx` (Expenses, Budgets), App. E.8 |

> **Decisions (revisitable):** **expenses** are one-off costs (logged, or derived from a receipt/transaction); **approvals** route above **£1,500 (UK) / S$2,500 (SG)** to the Principal; **associated costs** link an expense to assets (feeding lifetime cost, §9.6); **budgets** are per property + (optional) category, per year.

## 1. Purpose & user value
"The expense part" — log one-off spend, route anything above the threshold to the Principal for one-tap approval, attach costs to the assets they relate to (so a watch's service shows in its lifetime cost), and watch spend against budget per property. Pairs with the recurring side (F15/F16) to complete the management layer.

## 2. Roles & permissions
Resources `expense`, `approval`, `associated_cost`, `budget` (Principal-private with Manager operational, F02): **Principal** `admin` + **approves**; **Manager** `write` — log expenses, request approval, attach associated costs (operational); **Staff** `none`. Budgets/approval thresholds are Principal-set.

## 3. Data model
`V__budgets_expenses.sql`:
- **`expenses`** — `id, owner_id, property_id, category_id, payee text, merchant_id uuid null, description, amount_minor bigint, currency text, incurred_on date, payment_method_id uuid null (F16), status ('draft'|'pending_approval'|'approved'|'rejected'), requested_by uuid, receipt_id uuid null (F13), bank_transaction_id uuid null (F14), created_at, deleted_at`.
- **`approvals`** — `id, owner_id, subject_type ('expense'|'list_item'|'maintenance'), subject_id, threshold_minor bigint, threshold_currency, status ('pending'|'approved'|'rejected'), decided_by uuid null, decided_at null, note text null, created_at` (polymorphic — also serves Lists F08 / Maintenance F11 above-threshold).
- **`associated_costs`** — `id, owner_id, expense_id uuid null, kind ('cleaning'|'repair'|'restoration'|'transport'|'service'|'other'), amount_minor, currency, incurred_on, note, created_at`; **`associated_cost_asset_link`** — `(associated_cost_id, asset_id, allocation_minor)` (a cost split across assets → lifetime cost, F19/Insights).
- **`budgets`** — `id, owner_id, property_id, category_id uuid null, period_year int, amount_minor bigint, currency`; spend derived from expenses + reconciled transactions.

## 4. API
- Expenses: `GET /api/expenses?property=&status=` · `POST` · `PATCH` · `POST /:id/submit` (→ approval if above threshold) · `DELETE`.
- Approvals: `GET /api/approvals?status=pending` · `POST /api/approvals/:id/approve` · `/reject`.
- Associated costs: `POST /api/associated-costs` (+ asset links) · `GET /api/assets/:id/costs` (lifetime cost).
- Budgets: `GET/POST/PATCH /api/budgets` · `GET /api/budgets/:id/spend`.

## 5. UI / screens & states
Per `finance.jsx` (App. E.8):
- **Expenses tab**: **pending-approval block** (Approve/Reject, "above £1,500 threshold", requester, property/category/date) + **all-expenses table** (status pills Approved/Pending). "Log expense".
- **Budgets tab**: per-property annual (spent / of / % used) + a 5-month bar chart.
- **Surfaces**: Dashboard hero ("N expenses to approve" + amounts), mobile approve/reject.
- States: draft, pending-approval, approved, rejected; budget under/over.

## 6. Business rules & validation
- **Threshold routing**: an expense (or list item / maintenance cost) at/above the jurisdiction threshold (**£1,500 / S$2,500**, configurable, F02 Settings) creates a **pending approval** routed to the Principal; below threshold auto-approves. Approve/Reject is Principal-only; audited.
- **Associated cost → asset**: links feed the asset's **lifetime cost** (acquisition + operating, shown in Insights F29 / asset detail F19); a cost can split across multiple assets (allocations sum to total).
- **Expense provenance**: an expense may originate from a confirmed receipt (F13) and/or a reconciled transaction (F14), or be logged manually.
- **Budgets**: per property + optional category, per year; spend = approved expenses + reconciled transactions in scope; native-currency, no FX rollup by default.
- **Never moves money** (payment via F16).

## 7. Integrations
F13 (receipt → expense), F14 (transaction → expense/budget spend), F04/F19 (associated cost → asset lifetime cost), F16 (payment method), F11 (budget-overspend / approval reminders), F02 (thresholds + approve permission). 

## 8. Edge cases
Multi-currency thresholds (compare in native currency, no FX); approval of a list item / maintenance cost (polymorphic); associated cost split rounding; budget overspend alert; expense edited after approval (re-approval if it crosses threshold); rejected expense handling; delegation of approval (open Q).

## 9. Acceptance criteria
- **AC1** Logging a £1,840 expense routes it to the Principal as pending; below-threshold auto-approves.
- **AC2** The Principal approves/rejects from the Expenses block, the dashboard hero, and mobile; decisions are audited.
- **AC3** A repair cost attached to a watch appears in that asset's lifetime cost (and Insights).
- **AC4** A cost split across two assets allocates correctly (allocations sum to total).
- **AC5** Budget spent vs annual renders per property with the monthly bars; overspend alerts.
- **AC6** Thresholds compare in native currency (£ vs S$) with no silent FX.

## 10. Test plan
Backend (weaver+PG): threshold routing per jurisdiction; polymorphic approvals; associated-cost allocation + lifetime-cost rollup; budget spend derivation; re-approval on edit. Web: Vitest expenses/approval block + budgets bars; Playwright log→approve + associated cost on an asset.

## 11. Observability & audit
Audit: expense CRUD/submit, approval decisions, associated-cost links, budget changes. Metrics: pending approvals + ageing, approval turnaround, budget utilisation, associated cost by asset/category.

## 12. Open questions
1. **Approval delegation** (Principal away → delegate?). 2. Budget alert thresholds (e.g. 80%/100%). 3. Associated-cost allocation default (even split vs manual). 4. Whether reconciled transactions auto-create expenses or only inform budget spend.
