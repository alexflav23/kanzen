# Feature F06 — Tasks (native)

| | |
|---|---|
| **Feature ID** | F06 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (properties/projects), F02 (authz); feeds F07 (calendar), F11 (maintenance), F08 (lists), F25 (agent) |
| **Spec references** | SPEC §7.8 (native), §3.1 (v6.2 decision); `input/views/stubs.jsx → TasksView`, App. E.13 |

> **Decisions (this feature, planning-stage, revisitable):** tasks are a **native Kanzen domain** (decided in v6.2 — no Todoist as system-of-record); recurrence uses an **RFC-5545 RRULE subset** (interoperates with the calendar); **one task project per property** (auto-created with the property) + a few **system projects** (Finance, HR, General); reminders/notifications go via **EventBridge Scheduler → in-app + SES email + push (FCM/APNs)**; an **optional one-way mirror** to Todoist/Vikunja stays possible but non-authoritative.

---

## 1. Purpose & user value
The household's to-do backbone. Receiving a delivery, "be present for the HVAC service", "renew the TV licence", a defect to fix, a list to order — all are native tasks with assignees, due dates, recurrence and reminders, tightly woven into maintenance, defects, lists, deliveries and the calendar. One source of truth, Principal-private, no external dependency.

## 2. Roles & permissions
Resource `task` (+ `task_project`), property-scoped (F02):
- **Principal** — `admin`.
- **Manager** — `write`: create/assign/edit tasks across properties, manage projects/labels.
- **Staff** — `write` on **their own** tasks and tasks assigned to them (complete, comment), and raise issues; scoped to their property; cannot see others' tasks beyond their property.
- Assignee always sees their assigned tasks.

## 3. Data model
`V__tasks.sql`:

- **`task_projects`** — `id uuid pk`, `owner_id`, `name text`, `kind text` (`property`/`system`), `property_id uuid null → properties` (set for `property` kind; F03's `properties.task_project_id` points back), `created_at`, `deleted_at`. Auto-create one `property` project per property; seed system projects **Finance**, **HR**, **General**.
- **`tasks`** — `id uuid pk`, `owner_id`, `project_id → task_projects`, `title text`, `description text null`, `assignee_id uuid null → users`, `status text` (`todo`/`in_progress`/`done`/`cancelled`), `priority text` (`none`/`low`/`medium`/`high`), `due_at timestamptz null`, `due_all_day bool`, `timezone text` (per property: Europe/London or Asia/Singapore), `completed_at null`, `completed_by null`, `source_type text` (`manual`/`agent`/`maintenance_plan`/`defect`/`list`/`delivery`/`reminder`), `source_id uuid null`, `recurrence_rrule text null`, `recurring_template_id uuid null → tasks`, `created_by`, `created_at`, `updated_at`, `deleted_at null`.
- **`task_labels`** — `id, owner_id, name, kind ('category'|'vendor'|'custom'), color`; **`task_label_links`** — `(task_id, label_id)`.
- **`task_comments`** — `id, task_id, author_id, body, mentions uuid[], created_at`. Posting emits `task.comment.added` (F34) → notifies watchers/@-mentions.
- **`task_watchers`** — `(task_id, user_id)` — who gets notified on activity (auto: assignee + creator + commenters; the Principal can watch any).
- **Events**: `task.created|assigned|completed|reopened|comment.added` are emitted via the **event backbone (F34)** outbox → notifications/push. (Confirmed: tasks are **native**, not Vikunja — F34 makes notify-on-activity trivial across all domains.)
- **`notifications`** (shared infra, first defined here) — `id, owner_id, user_id, kind, title, body, link, channels_sent jsonb, read_at null, created_at`.

## 4. API (Tapir endpoints)
- **Projects**: `GET/POST/PATCH/DELETE /api/task-projects` (system + per-property).
- **Tasks**: `GET /api/tasks` (filters: project, assignee, status, due range, label, `mine=true`) · `GET /:id` · `POST` · `PATCH` · `POST /:id/complete` · `POST /:id/reopen` · `POST /:id/cancel` · `POST /:id/assign`.
- **Recurrence**: a task with `recurrence_rrule` is a **template**; completing/closing an occurrence materialises the next (or a scheduler materialises upcoming occurrences). `GET /api/tasks/:id/occurrences`.
- **Comments/labels**: CRUD + attach.
- **Calendar feed**: `GET /api/tasks/calendar?from&to` (due tasks for F07 overlay).

## 5. UI / screens & states
Per `TasksView` + App. E.13:
- **Tasks view**: native rows (title, **project**, **assignee**, **due**, **maintenance/source flag**, priority, recurring marker); filters (project, mine, status, overdue); group by due/project. Create-task; quick-complete checkbox.
- **Surfaces elsewhere**: Dashboard (today + overdue), Calendar overlay (F07), Inbox (raised issues), Property → Defects (defect→task), Maintenance (plan→recurring task), Lists (order task). Agent-created tasks carry the **agent ribbon**.
- **States**: empty, loading, overdue (amber), completed (struck), recurring (icon), error.

## 6. Business rules & validation
- **Recurrence** via RRULE subset (FREQ daily/weekly/monthly/yearly, INTERVAL, BYDAY/BYMONTHDAY, COUNT/UNTIL); completing an occurrence spawns the next; the template carries the rule, occurrences carry `recurring_template_id`.
- **Timezone** per property (London/Singapore); due times respect it; reminders fire in local time.
- **Source linkage**: completing a `maintenance_plan` task writes a `MaintenanceLog` (F11) and rolls the plan; a `delivery` task pairs with a calendar event (F07); a `defect` task closes/links the defect (F03); a `list` order task closes the list cycle (F08).
- **Reminders**: due + configurable lead → EventBridge Scheduler → `notifications` via the user's channel prefs (in-app + SES email + push). 
- **Status**: `todo → in_progress → done`; `cancelled` is terminal; reopen allowed (audited).
- **Scope/assignment**: Staff only see their property + assigned tasks (F02).

## 7. Integrations / external systems
- **Event backbone (F34)** — task create/assign/complete/comment emit domain events → notification fan-out (in-app + SES + **APNs/FCM push**, e.g. push a staff member when assigned, ping the Principal on completion/comment).
- **EventBridge Scheduler** — reminder firing, recurrence materialisation.
- **Frontend libraries** for the complex *UI* (rich-text comment editor, @-mention picker) — the data + events stay ours; no backend task dependency.
- **Optional mirror** (Todoist/Vikunja) — a later, non-authoritative one-way export adapter behind a `TaskMirror` interface; off by default.
- No external task system is authoritative.

## 8. Edge cases
- Completing a recurring task → next occurrence created; editing the template vs one occurrence (scope of edit prompt).
- Reassigning across property scopes → assignee must have scope/visibility.
- Deleting a project with open tasks → blocked (reassign/close first).
- Overdue recurring task not completed before next due → don't pile infinite occurrences (materialise lazily, cap).
- Timezone DST boundaries; cross-property tasks.
- Agent-created delivery task + calendar event must stay paired (F07) — delete one prompts about the other.
- Source object deleted (e.g., defect resolved) → task remains with a dangling-source note.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Property creation auto-generates projects**  ‹maps: `TaskProjectIT.autoCreate`, web `tasks.spec` projects›
- **Given** a freshly created property *Wardian, Apt 5206*
- **When** the property is saved
- **Then** a `property`-kind task project named *Wardian, Apt 5206* is auto-created and linked via `task_project_id`
- **And** system projects **Finance**, **HR**, and **General** exist independently of any property.

**AC2 — Recurring task generates next occurrence on completion**  ‹maps: `RecurrenceIT.nextOccurrence`, web `tasks.spec` recurring, mobile `tasks_test.dart`›
- **Given** a recurring "Daikin VRV-IV quarterly service" task with an RRULE `FREQ=MONTHLY;INTERVAL=3` assigned to Lorna
- **When** Lorna completes the current occurrence
- **Then** a new occurrence is created with `recurring_template_id` pointing to the original template and a due date advanced per the RRULE
- **And** a reminder fires (in-app + SES email) at the configured lead days, respecting the Wardian timezone (Europe/London).

**AC3 — Agent-created delivery task carries the agent ribbon**  ‹maps: `AgentDeliveryTaskIT`, web `tasks.spec` agent-ribbon, mobile `tasks_test.dart`›
- **Given** The Agent processes a delivery email and creates a delivery task
- **When** Lorna or Marcia opens the Tasks view
- **Then** the task carries `source_type = 'agent'` and the **agent ribbon** is visible in the UI
- **And** the task is assigned to the Wardian housekeeper with the delivery time window; it is paired with the calendar event (F07) so deleting one prompts about the other.

**AC4 — Staff scope: Marcia sees only Wardian tasks (negative)**  ‹maps: `TaskScopeIT`, web `tasks.spec` scope, mobile `tasks_test.dart`›
- **Given** Marcia is Wardian-Staff and Singapore has its own tasks
- **When** Marcia lists tasks (`GET /api/tasks`)
- **Then** she sees only Wardian tasks and tasks assigned to her; no Singapore tasks are returned
- **And** a direct request for a Singapore task ID returns **403/404** — existence not leaked.

**AC5 — Completing a maintenance task writes a MaintenanceLog and rolls the plan**  ‹maps: `MaintenanceLinkIT`, web `tasks.spec` maintenance-source›
- **Given** a task with `source_type = 'maintenance_plan'` linked to an active plan
- **When** Lorna marks it done
- **Then** a `MaintenanceLog` entry is created with the completion date and any notes/cost provided
- **And** the plan's `next_due` is rolled forward per its RRULE (F11) and audited.

**AC6 — Reminders fire in property-local timezone**  ‹maps: `ReminderTimezoneIT`, web `tasks.spec` reminders›
- **Given** a task due at 09:00 local time in Singapore (`Asia/Singapore`)
- **When** the EventBridge scheduler fires the reminder at the configured lead
- **Then** the notification is delivered at the correct local time, not UTC
- **And** the same engine fires in `Europe/London` time for Wardian tasks.

**AC7 — Staff cannot create or manage projects (negative)**  ‹maps: `TaskAuthzIT`›
- **Given** Marcia (Staff)
- **When** she attempts to `POST /api/task-projects` or `DELETE /api/task-projects/:id`
- **Then** she is **denied (403, default-deny)**
- **And** she can complete her own assigned tasks but cannot see or edit tasks assigned to other users.

**AC8 — Overdue recurring task does not pile occurrences**  ‹maps: `RecurrenceCapIT`›
- **Given** a weekly recurring task with 3 missed due dates
- **When** the scheduler materialises occurrences
- **Then** at most one pending overdue occurrence exists per template (lazy materialisation, capped)
- **And** no infinite series of back-dated occurrences is created.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG): RRULE expansion + next-occurrence; reminder scheduling (mock EventBridge); source-linkage side-effects (maintenance/defect/list); scope + assignment enforcement; timezone handling; project-delete guard.
- **Web**: Vitest for the task list/filters + recurring/overdue rendering; Playwright e2e create→assign→complete and a recurring task.
- **Notifications**: channel fan-out (in-app/email/push) per prefs.

## 11. Observability & audit
- Audit: task create/edit/assign/complete/cancel/reopen, project + label changes, recurrence edits.
- Metrics: open/overdue tasks by property/assignee, completion rate, reminder delivery success, recurrence materialisation.

## 12. Open questions / decisions
1. **Push provider setup** — FCM + APNs credentials/infra (lands properly with F31 Flutter); web push too?
2. **Recurrence edit scope UX** — "this occurrence / this and future / all" (calendar-style).
3. **External mirror** — confirm whether to build the optional Todoist/Vikunja export in v1 or defer entirely.
4. **Notifications entity ownership** — `notifications` defined here as shared infra; confirm it's the single notification table for agent/finance/reminders too.
