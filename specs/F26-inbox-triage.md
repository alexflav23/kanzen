# Feature F26 — Unified Inbox & Triage

| | |
|---|---|
| **Feature ID** | F26 |
| **Milestone** | M6 |
| **Domain** | Agent |
| **Status** | ✅ spec complete |
| **Depends on** | F25 (agent), F14 (reconciliation), F23 (data quality), F11 (reminders) |
| **Spec references** | SPEC §3.6, §7.2; `input/views/inbox.jsx`, `triage.jsx`, App. E.3 |

> **Decisions (made):** one **Inbox** with **four streams** — **Agent proposals (Triage)**, **Reconciliation**, **Data quality**, **Reminders** — each with live counts; Triage is master/detail with **editable extracted fields** and **proposed actions**, **Confirm · execute N** (⌘↵), edit-then-confirm, reject (feeds learning), success toast; tabs **Queue / History / Trust settings**.

## 1. Purpose & user value
The single place that surfaces everything needing a human eye — what the agent proposes, what won't reconcile, what's incomplete, what's coming due — so the household runs from one calm queue rather than scattered notifications.

## 2. Roles & permissions
Scoped per F02: **Principal** all streams; **Manager** agent proposals (non-financial confirm; financial review), reconciliation, data quality; **Staff** only items relevant to their scope (e.g. raised issues). Confirming an action executes it under the **acting user's** permissions.

## 3. Data model
Primarily a **view/aggregation layer** over `agent_actions`/`incoming_emails` (F25), `reconciliation_*` (F14), `asset_quality_flags` (F23), `reminders` (F11). Stream counts are derived; per-item confirm/reject mutate the underlying feature.

## 4. API
- `GET /api/inbox?stream=agent|reconciliation|quality|reminders` (counts + items).
- **Agent**: `POST /api/agent/actions/:id/confirm` (optionally with edited `extracted`/payload) · `/reject` · bulk confirm. **Reconciliation**: confirm/link/ignore (F14). **Quality**: resolve/dismiss (F23). **Reminders**: snooze/act/done (F11).
- `GET /api/agent/history` · trust settings (F27).

## 5. UI / screens & states
Per `inbox.jsx`/`triage.jsx` (App. E.3):
- **Tabs/streams** with count pills (Agent · Reconciliation · Data quality · Reminders).
- **Triage**: master list (category, variance, time) + detail (email excerpt → **editable agent-extracted KV fields** → **proposed actions** with typed icons) → footer **Reject / Edit & confirm / Confirm · execute N** (⌘↵) + success toast. **History** (auto/confirmed/rejected). **Trust settings** (F27; financial locked).
- **Reconciliation/Quality/Reminders** streams render their feature views (F14/F23/F11).
- States: items / inbox-zero ("Inbox zero, on the agent's side."), loading, error.

## 6. Business rules & validation
- **Confirm executes** the proposed actions atomically (or reports partial failure); **edit-then-confirm** applies user edits to the extracted data first. **Financial/asset** proposals always require explicit confirm (never bulk-auto).
- **Reject** dismisses + logs a sender-learning signal (F25/F27).
- Stream counts live-update; keyboard nav (↑/↓ select, ⌘↵ confirm, esc).
- Confirming runs under the actor's authz (a Manager confirming can't create what they lack permission for).

## 7. Integrations
F25 (agent actions), F14 (reconciliation), F23 (quality), F11 (reminders), F27 (trust). The single review surface across all.

## 8. Edge cases
Action target changed/deleted before confirm; partial execution (one action fails); concurrent reviewers (item claimed/locked); bulk confirm with a mix of financial (excluded) + non-financial; very large queues (pagination); edited extraction invalidates an action.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Four streams show live counts and render correctly**  ‹maps: `InboxStreamCountIT`, web `inbox.spec` streams, mobile `InboxTabTest`›
- **Given** items exist across all four streams (agent proposals, reconciliation gaps, quality flags, reminders)
- **When** Lorna opens the Inbox
- **Then** each tab (Agent · Reconciliation · Data quality · Reminders) shows an accurate count pill
- **And** switching between tabs renders the correct stream view without reloading the page.

**AC2 — Confirm executes actions atomically and toasts**  ‹maps: `TriageConfirmIT`, web `triage.spec` confirm-toast, mobile `TriageConfirmTest`›
- **Given** a proposed Triage item with two actions (e.g. create task + file document)
- **When** Lorna clicks **Confirm · execute 2** (or presses ⌘↵)
- **Then** both actions execute atomically; the results are linked to the source email via `agent_action_result_link`; a success toast appears
- **And** the item moves to History with `status = confirmed`, audited.

**AC3 — Edit-then-confirm applies user edits to the created record**  ‹maps: `TriageEditConfirmIT`, web `triage.spec` edit-confirm›
- **Given** a proposed task action where the agent extracted the wrong due date
- **When** Lorna edits the due-date field in the KV editor then confirms
- **Then** the created task reflects the corrected due date, not the agent's original extraction
- **And** the edit is audited; the original extracted payload is preserved for audit.

**AC4 — Financial proposals require explicit confirm; bulk-auto is blocked**  ‹maps: `FinancialBulkBlockIT`, web `triage.spec` bulk-financial›  *(invariant: financial/asset creation never auto-commits)*
- **Given** a mixed queue of financial proposals (propose_asset, reconcile_bill) and non-financial (create_task)
- **When** Lorna attempts a bulk-confirm-all
- **Then** the financial/asset items are excluded from the bulk operation and remain in the queue
- **And** each financial item requires an individual explicit confirm; the system never auto-commits them.

**AC5 — Reject dismisses the item and feeds sender learning**  ‹maps: `TriageRejectIT`, web `triage.spec` reject, mobile `TriageRejectTest`›
- **Given** a proposed action Toby does not want to execute
- **When** he clicks **Reject**
- **Then** `agent_actions.status = rejected`; a sender-learning signal is written (F27); the item leaves the queue
- **And** no records are created; the source document in S3 remains immutable.

**AC6 — Inbox-zero state renders when the agent stream is empty**  ‹maps: `InboxZeroIT`, web `inbox.spec` inbox-zero›
- **Given** all agent proposals have been actioned (confirmed or rejected)
- **When** Lorna views the Agent tab
- **Then** the inbox-zero state ("Inbox zero, on the agent's side.") renders correctly
- **And** the count pill shows 0.

**AC7 — Confirming under actor authz: Manager cannot create what they lack permission for**  ‹maps: `ConfirmAuthzIT`, web `triage.spec` authz›
- **Given** a proposed action that would create a financial record requiring Principal-level permission
- **When** Lorna (Manager) attempts to confirm it
- **Then** confirmation is denied (403) with a clear error; no record is created
- **And** the item remains in the queue for Toby to action.

**AC8 — Staff see only scope-relevant items (negative)**  ‹maps: `InboxScopeIT`, web `inbox.spec` scope›
- **Given** Marcia is Wardian-Staff
- **When** she opens the Inbox
- **Then** she sees only items relevant to her scope; Wardian agent proposals and Singapore items are absent
- **And** no Singapore data is revealed in counts or summaries.

## 10. Test plan
Backend (weaver+PG): stream aggregation + counts; confirm/edit/reject execution + result links; actor-authz on confirm; partial-failure handling. Web: Vitest streams + Triage detail + keyboard; Playwright confirm/edit/reject + inbox-zero.

## 11. Observability & audit
Audit: confirm/edit/reject per action, stream resolutions. Metrics: queue depth by stream, time-to-triage, confirm/reject ratio, edit rate.

## 12. Open questions
1. Multi-reviewer locking. 2. Bulk-confirm policy (non-financial only). 3. Notifications ↔ Inbox relationship (in-app center vs the Inbox itself).
