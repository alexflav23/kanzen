# Feature F15 — Bills & recurring schedule

| | |
|---|---|
| **Feature ID** | F15 |
| **Milestone** | M3 |
| **Domain** | Finance |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (property), F09 (payee/vendor), F11 (reminders); feeds F16 (pay queue), F25 (agent reconciliation) |
| **Spec references** | SPEC §9.5; `input/views/finance.jsx` (Recurring bills), `properties.jsx` (Utilities), App. E.8 |

> **Decisions (revisitable):** recurring bill schedule per property; **agent reconciles incoming invoice emails** against the schedule (updates amount + next-due) and **flags variance at ±15%** (configurable); reminders via the F11 engine at a **5-day lead** (configurable); bills reference a **payment method** (F16) and link to invoices (F13) + transactions (F14).

## 1. Purpose & user value
Every recurring cost — utilities, service contracts, subscriptions, SP Group, council tax — on one rolling schedule that reminds ahead of time and flags when an amount jumps unexpectedly. The backbone the Pay queue (F16) and the agent's invoice handling sit on.

## 2. Roles & permissions
Resource `bill` (property-scoped, F02): **Principal/Manager** `write`; **Staff** scoped `read` where granted.

## 3. Data model
`V__bills.sql`:
- **`bills`** — `id, owner_id, payee text, vendor_id uuid null → vendors, property_id → properties, category text, amount_minor bigint, currency text, frequency text (RRULE/preset), payment_method_id uuid null (F16), next_due date, lead_days int default 5, auto bool (settled by DD/GIRO/card), last_seen_minor bigint null, prev_seen_minor bigint null, variance_flag bool default false, active bool, created_at, updated_at, deleted_at`.

## 4. API
`GET /api/bills?property=` · `GET /:id` · `POST` · `PATCH` · `POST /:id/roll` (advance next_due) · `POST /:id/ack-variance` · `DELETE`. A scheduled **roll-forward + reminder** job (EventBridge → F11).

## 5. UI / screens & states
Per `finance.jsx` Recurring bills tab + App. E.8: summary strip (due this month GBP/SGD, **variance flagged**, next 7 days); schedule table (payee, category, property, frequency, next due + countdown, amount, method, variance pill); **variance detail card** (agent ribbon, "SP Group usage up 59.6%", View statement / Open Triage / Acknowledge). Property → **Utilities** tab mirrors per-property. States: due-soon, variance-flagged, inactive.

## 6. Business rules & validation
- **Roll-forward**: on/after `next_due`, advance per frequency; raise a reminder at `lead_days`.
- **Agent reconciliation** (F25): an inbound invoice email matched to a bill updates `last_seen`/`amount`/`next_due`; if the change ≥ **±15%** vs `prev_seen`, set `variance_flag` and surface in Inbox + the variance card (never silently — financial, §10.3).
- **Payment method**: bills carry a `payment_method_id` (F16) and an `auto` flag (DD/GIRO/card vs manual) driving the Pay queue.
- **Multi-currency** native (GBP/SGD), no FX.

## 7. Integrations
F11 (lead reminders + roll-forward schedule), F16 (pay queue + payment method), F13/F25 (invoice email → bill reconciliation + variance), F14 (bill payment ↔ transaction). 

## 8. Edge cases
Frequency change mid-schedule; variance flag ack vs persistent; payee/vendor change; first-seen (no prev to compare); seasonal bills; agent proposes a new bill (not in schedule) → review.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Bill rolls forward and raises a lead reminder**  ‹maps: `BillRollForwardIT`, web `bills.spec` schedule›
- **Given** a monthly Wardian electricity bill with `next_due` today
- **When** the roll-forward job runs
- **Then** `next_due` advances by one month and a 5-day-lead reminder is scheduled via F11
- **And** the bill row is audited (roll event) and the countdown in the Utilities tab updates.

**AC2 — Agent-reconciled invoice raises variance flag**  ‹maps: `BillVarianceIT`, web `bills.spec` variance-card›
- **Given** the SP Group bill with `prev_seen_minor` = historical amount
- **When** The Agent processes an inbound SP Group invoice email with an amount 59.6% higher
- **Then** `last_seen_minor` and `amount_minor` are updated, `variance_flag=true` is set, and the variance is surfaced in the Inbox + the variance detail card (including the agent ribbon)
- **And** the variance was **not** silently applied — it surfaces for Toby or Lorna to acknowledge; flagged because the change exceeds the ±15% threshold.

**AC3 — Bills show due-this-month totals split by currency**  ‹maps: `BillCurrencyTotalsIT`, web `bills.spec` summary-strip›
- **Given** Wardian bills in GBP and Singapore bills in SGD due this month
- **When** Toby (or Lorna) views the Recurring bills summary strip
- **Then** totals are shown as **two separate figures** (GBP and SGD) — no silent FX conversion
- **And** the per-bill table shows each bill in its native currency.

**AC4 — Auto bill materialises in Pay queue as Scheduled**  ‹maps: `AutoBillPayQueueIT`›  *(invariant: Kanzen never moves money)*
- **Given** a bill with `auto=true` linked to a Direct Debit payment method
- **When** the pay-queue materialisation job runs for the next 30-day window
- **Then** a `bill_payment` row is created with `mode=auto` and `state=scheduled`; it appears in Lorna's Pay queue under the **Auto / Scheduled** classification
- **And** Kanzen does not initiate any payment — the DD settles externally; "Mark paid" (F16) records reality only.

**AC5 — Agent proposes new bill; human must confirm**  ‹maps: `AgentNewBillProposalIT`›  *(invariant: financial creation proposed-not-auto-committed)*
- **Given** an inbound invoice email for a service not yet in the bill schedule
- **When** The Agent processes it
- **Then** the agent **proposes** a new bill entry (status `proposed`) in the Inbox — it does **not** create the bill record automatically
- **And** Toby or Lorna must confirm before the bill is added to the schedule.

**AC6 — Staff cannot access bills (negative)**  ‹maps: `BillAuthzIT`›  *(invariant: server-side scope; no leak)*
- **Given** Marcia (Wardian Staff) and Siti (Singapore Staff)
- **When** either requests `GET /api/bills`
- **Then** both receive **403** — no bill amounts, due dates, or variance data are revealed
- **And** Marcia cannot see Singapore bills even if she guesses a bill ID (scope enforced per row, existence not leaked).

## 10. Test plan
Backend (weaver+PG): roll-forward math, variance threshold, agent-reconcile update path, reminder scheduling. Web: Vitest schedule table + variance card; Playwright add-bill + variance flow.

## 11. Observability & audit
Audit: bill CRUD, roll, variance flag/ack, agent updates. Metrics: due-soon by property/currency, variance rate, on-time vs late.

## 12. Open questions
1. Variance threshold per category (±15% default). 2. New-bill-from-agent auto vs always-review (lean: review). 3. Seasonal/variable bill handling.
