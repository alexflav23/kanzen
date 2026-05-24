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
- **`expenses`** — `id, owner_id, property_id, category_id, payee text, merchant_id uuid null, description, amount_minor bigint, currency text, incurred_on date, payment_method_id uuid null (F16), status ('draft'|'pending_approval'|'approved'|'rejected'), requested_by uuid, receipt_id uuid null (F13), bank_transaction_id uuid null (F14), tax_rate_pct numeric null, vat_minor bigint null, deductible bool default false, deductible_pct numeric null, created_at, deleted_at`. *(tax/deductibility fields — ported from marvis — feed F38; the Agent may **propose** `deductible` (F27), never set it.)*
- **Income** is **not** an expense row: income = `bank_transactions` with `category.kind='income'` (F12), sub-categorised **salary / dividend / rental / interest / other**. F17 recognises it only for **net budget/cashflow** and as the source F38 derives salary/dividends from — income is never approval-routed.
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
- **Income vs expense (cashflow)**: income credits (F12, `kind='income'`, sub-categorised salary/dividend/rental/interest/other) are tracked alongside expenses for a **net cashflow** view and feed **F38** tax estimates + **F29** reporting. Income is **never** subject to expense approval and never counts as spend against a budget.
- **Deductibility / VAT**: an expense may carry a `tax_rate_pct`, `vat_minor` and a `deductible`/`deductible_pct` flag (partial allowed). These drive **F38**'s deductible-expense report and VAT-reclaimable total; non-deductible expenses are excluded from those totals. FX-normalised via F37 before totalling.
- **Never moves money** (payment via F16).

## 7. Integrations
F13 (receipt → expense), F14 (transaction → expense/budget spend), F04/F19 (associated cost → asset lifetime cost), F16 (payment method), F11 (budget-overspend / approval reminders), F02 (thresholds + approve permission). 

## 8. Edge cases
Multi-currency thresholds (compare in native currency, no FX); approval of a list item / maintenance cost (polymorphic); associated cost split rounding; budget overspend alert; expense edited after approval (re-approval if it crosses threshold); rejected expense handling; delegation of approval (open Q).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Above-threshold expense routes to Principal; below-threshold auto-approves**  ‹maps: `ExpenseThresholdRoutingIT`, web `expenses.spec` approval-block›
- **Given** the UK approval threshold is £1,500
- **When** Lorna logs a £1,840 expense (e.g. a Wardian repair) and submits it
- **Then** an `approvals` row is created (`status=pending`), the expense enters `status=pending_approval`, and the Principal's dashboard hero shows "1 expense to approve"
- **And** when Lorna logs a £900 expense the same day, it auto-approves (`status=approved`) with no approval row created.

**AC2 — Principal approves/rejects from all surfaces; decisions audited**  ‹maps: `ApprovalDecisionIT`, web `expenses.spec` approve, mobile `approve.spec`›  *(invariant: Kanzen never moves money — approval records intent, does not pay)*
- **Given** a pending £1,840 expense
- **When** Toby approves it from the Expenses block, the dashboard hero strip, or the mobile one-tap view
- **Then** `approvals.status=approved`, `decided_by=Toby`, `decided_at` is set, and the audit log records the decision
- **And** rejection sets `status=rejected` with an optional note; both outcomes are audited; no funds are disbursed.

**AC3 — Repair cost appears in asset lifetime cost**  ‹maps: `AssociatedCostLifetimeIT`, web `asset-detail.spec` lifetime-cost›
- **Given** a confirmed watch asset (F04) and a £350 service expense
- **When** Lorna creates an `associated_cost` linking the expense to the watch
- **Then** the watch's lifetime cost (acquisition + operating) increases by £350 and is visible on the asset detail (F19) and Insights (F29)
- **And** the associated cost is audited.

**AC4 — Cost split across two assets allocates correctly**  ‹maps: `AssociatedCostSplitIT`›
- **Given** a £600 transport cost to be split between two watches
- **When** Lorna links it with `allocation_minor=300_00` for each asset
- **Then** both `associated_cost_asset_link` rows are created; allocations sum exactly to the total (£600); the lifetime cost of each watch increases by £300
- **And** the engine rejects any split that does not sum to the total cost.

**AC5 — Budget utilisation renders with monthly bars and overspend alert**  ‹maps: `BudgetSpendIT`, web `budgets.spec`›
- **Given** Wardian has an annual GBP budget with 5 months of approved expenses
- **When** Toby or Lorna views the Budgets tab
- **Then** each property shows spent/of/% used with a 5-month bar chart; native currency only (GBP for Wardian, SGD for Singapore)
- **And** when spend exceeds the budget, an overspend indicator is shown.

**AC6 — Thresholds compare in native currency; no silent FX**  ‹maps: `ThresholdNativeCurrencyIT`›  *(invariant: FX uses transaction-date rate — F37; thresholds stay per-jurisdiction native)*
- **Given** Wardian threshold is £1,500 and Singapore threshold is S$2,500
- **When** a S$2,600 Singapore expense is logged
- **Then** it routes to approval (S$2,600 > S$2,500 native); there is **no FX conversion** applied to the threshold comparison
- **And** a Wardian £1,400 expense does not trigger approval — each jurisdiction is compared only in its native currency.

**AC7 — Staff cannot access expenses, approvals, or budgets (negative)**  ‹maps: `ExpenseAuthzIT`›  *(invariant: server-side scope; no leak via totals)*
- **Given** Marcia (Wardian Staff)
- **When** she requests `GET /api/expenses`, `GET /api/approvals`, or `GET /api/budgets`
- **Then** she receives **403** on all three — no amounts, categories, or approval statuses are revealed
- **And** Lorna (Manager) can log and submit expenses and view budgets, but cannot see asset valuations (stripped server-side, F02).

**AC8 — Income is categorised, feeds cashflow, and is never approval-routed**  ‹maps: `IncomeCategorisationIT`, web `cashflow.spec`›
- **Given** a £6,000 credit (F12) categorised as income → **salary**, and a £400 credit categorised income → **dividend**
- **When** the finance view loads
- **Then** both appear as **income** in the net cashflow (income − expense), **not** as spend against any budget, and **no approval** row is created for them
- **And** F38's tax estimate can derive salary (£6,000) and dividends (£400) from these categorised income transactions.

**AC9 — Deductible/VAT flags on an expense feed F38**  ‹maps: `ExpenseDeductibleFlagIT`›
- **Given** a £120 expense with `tax_rate_pct=20`, `vat_minor=2000`, `deductible=true`
- **When** F38's deductible report for the year runs
- **Then** this expense contributes to the **deductible total** and its £20 VAT to the **VAT-reclaimable** total, FX-normalised (F37)
- **And** a `deductible=false` expense contributes to neither.

## 10. Test plan
Backend (weaver+PG): threshold routing per jurisdiction; polymorphic approvals; associated-cost allocation + lifetime-cost rollup; budget spend derivation; re-approval on edit. Web: Vitest expenses/approval block + budgets bars; Playwright log→approve + associated cost on an asset.

## 11. Observability & audit
Audit: expense CRUD/submit, approval decisions, associated-cost links, budget changes. Metrics: pending approvals + ageing, approval turnaround, budget utilisation, associated cost by asset/category.

## 12. Open questions
1. **Approval delegation** (Principal away → delegate?). 2. Budget alert thresholds (e.g. 80%/100%). 3. Associated-cost allocation default (even split vs manual). 4. Whether reconciled transactions auto-create expenses or only inform budget spend.
