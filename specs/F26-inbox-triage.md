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

## 9. Acceptance criteria
- **AC1** All four streams show correct live counts; switching streams renders the right view.
- **AC2** Confirming a Triage item executes its actions, links results to the email, and toasts; ⌘↵ works.
- **AC3** Editing an extracted field before confirm changes the created record.
- **AC4** A financial proposal can't be bulk-auto-confirmed; rejection feeds learning.
- **AC5** Inbox-zero state renders when the agent stream is empty.

## 10. Test plan
Backend (weaver+PG): stream aggregation + counts; confirm/edit/reject execution + result links; actor-authz on confirm; partial-failure handling. Web: Vitest streams + Triage detail + keyboard; Playwright confirm/edit/reject + inbox-zero.

## 11. Observability & audit
Audit: confirm/edit/reject per action, stream resolutions. Metrics: queue depth by stream, time-to-triage, confirm/reject ratio, edit rate.

## 12. Open questions
1. Multi-reviewer locking. 2. Bulk-confirm policy (non-financial only). 3. Notifications ↔ Inbox relationship (in-app center vs the Inbox itself).
