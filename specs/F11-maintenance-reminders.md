# Feature F11 — Maintenance plans & reminder engine

| | |
|---|---|
| **Feature ID** | F11 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets/systems), F06 (tasks), F07 (calendar), F09 (vendors), F03 (property); the **reminder engine is cross-cutting** |
| **Spec references** | SPEC §3.7, §7.3/§7.14; `input/views/add-maintenance.jsx`, `properties.jsx` (Maintenance tab), App. E.17 |

> **Decisions (revisitable):** **one maintenance + reminder engine** serves both property systems and registry assets (SPEC §3.7); a plan **generates a recurring native task (F06) + calendar event (F07) + reminders**; completion writes a **MaintenanceLog** (cost/notes/docs) feeding the asset's lifetime cost; the **reminder engine is the shared scheduler** for maintenance, warranties, appraisals, backups, permits, reviews, bills and lists.

## 1. Purpose & user value
Nothing that needs servicing gets forgotten — the HVAC, the pool filter, a watch service, a warranty about to lapse, an annual backup. Plans schedule the work, assign the vendor, remind the right person (Lorna) ahead of time, and record what was done and what it cost. The reminder engine underneath is the platform's single "things coming due" heartbeat (the Inbox **Reminders** stream).

## 2. Roles & permissions
Resource `maintenance_plan`/`maintenance_log`/`reminder`, property-scoped (F02): **Principal/Manager** `write` plans; **Staff** `read` their property's plans + complete "be-present" tasks; vendors restricted to property-approved + insured (F09).

## 3. Data model
`V__maintenance.sql`:
- **`maintenance_plans`** — `id, owner_id, property_id null, asset_id uuid null → assets (system or registry asset), vendor_id → vendors, title, frequency text (RRULE), first_due date, lead_days int, expected_cost_minor bigint null, currency text null, creates_task bool default true, active bool, next_due date, created_at, updated_at, deleted_at`.
- **`maintenance_logs`** — `id, plan_id uuid null, asset_id uuid null, performed_at date, vendor_id, cost_minor bigint null, currency, notes, document_ids uuid[], created_by, created_at`. (Cost optionally becomes an `associated_cost` on the asset — F19/§9.6.)
- **`reminders`** (shared engine) — `id, owner_id, kind ('maintenance'|'warranty'|'appraisal'|'backup'|'permit'|'review'|'bill'|'list'), source_type, source_id, due_at timestamptz, lead_days int, status ('scheduled'|'sent'|'snoozed'|'done'), snooze_until null, channels jsonb, created_at`.

## 4. API
- **Plans**: `GET /api/maintenance/plans?property=` · `GET /:id` · `POST` (the 3-step add-plan) · `PATCH` · `POST /:id/complete` (→ log + roll `next_due` + task) · `DELETE`.
- **Logs**: `GET /api/maintenance/logs?asset=|plan=` · `POST`.
- **Reminders (engine)**: `GET /api/reminders?stream=due` (Inbox) · `POST /api/reminders/:id/snooze` · `/act` · `/done`. A scheduled **scan job** (EventBridge) materialises due reminders across all `kind`s and fans out notifications (in-app/SES/push).

## 5. UI / screens & states
- **Add-maintenance modal** (`add-maintenance.jsx`, App. E.17): 3 steps — **1** Asset & vendor (vendors property-scoped + insured); **2** Schedule (frequency segmented, first due, lead days, expected cost+currency, **Create recurring task** toggle); **3** Review (summary + "reminders go to Lorna, calendar N days before").
- **Property → Maintenance tab** + a top-level **Maintenance** view: plans table (asset, vendor, frequency, next due, expected cost, lead).
- **Inbox → Reminders stream**: maintenance/warranty/appraisal/backup/permit rows with due/lapsed + Snooze/Act (App. E.3).
- **States**: scheduled, due-soon, overdue/lapsed, completed; vendor-insurance-expired warning.

## 6. Business rules & validation
- A plan **generates**: a recurring **native task** (F06, when `creates_task`) assigned to the property's housekeeper/manager; a **calendar event** (F07); and **reminders** at `lead_days`.
- **Completion** (task done or explicit) → `maintenance_log` (cost/notes/docs), rolls `next_due` per RRULE, optionally creates an **associated cost** on the asset (lifetime cost, F19).
- **Reminder engine**: one scan emits all due reminders across domains; **Lorna** is the default maintenance recipient (configurable); snooze/act/done lifecycle; everything also lands in the Inbox Reminders stream and dashboard "expiring within 60 days".
- **Vendor guard**: only property-approved, insured vendors selectable.
- **Variance**: actual vs `expected_cost` flagged (ties to Finance variance, F15/F17).

## 7. Integrations
F06 (task), F07 (event), F09 (vendor), F05 (log documents), F04/F19 (asset + associated cost), EventBridge + SES + push (reminder fan-out). The **reminder engine** also serves F12 (consent expiry), F15 (bill lead), F08 (order day), F10 (permits/reviews), F30 (backup due), F19/F21 (warranty/appraisal).

## 8. Edge cases
- Plan completion before/after due → `next_due` recalculated. Vendor insurance lapses before a visit → warn. Task deleted but plan active → regenerate. Asset sold/archived with active plan → pause plan. Reminder snoozed past next due → coalesce. Backup-due reminder with no plan (system-generated). Multi-property scan performance.

## 9. Acceptance criteria
- **AC1** Creating a plan via the 3-step modal generates a recurring task + calendar event + lead reminders to Lorna.
- **AC2** Completing the service writes a MaintenanceLog (with cost + docs), rolls next-due, and (for a registry asset) adds an associated cost.
- **AC3** The Inbox Reminders stream shows maintenance, a lapsed warranty, an appraisal refresh, and a backup-due — from the one engine.
- **AC4** A vendor with expired insurance can't be selected for a new plan.
- **AC5** Snoozing/acting on a reminder updates its lifecycle and audit.

## 10. Test plan
Backend (weaver+PG; mock EventBridge): plan→task/event/reminder generation; completion→log+roll+associated-cost; multi-kind reminder scan + fan-out; vendor guard; RRULE rolling; snooze coalescing. Web: Vitest add-maintenance stepper + reminders stream; Playwright create-plan→complete.

## 11. Observability & audit
Audit: plan CRUD, completion/log, reminder snooze/act/done. Metrics: overdue plans, reminder delivery success, expected-vs-actual cost variance, reminders by kind.

## 12. Open questions
1. Default reminder recipient(s) per kind (Lorna for maintenance — confirm others). 2. Lead defaults per kind. 3. Whether the reminder engine is its own micro-feature vs embedded here (it's cross-cutting; specced here, consumed widely). 4. Associated-cost creation automatic vs prompted on completion.
