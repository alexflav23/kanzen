# Feature F07 — Calendar (Google Calendar, two-way sync)

| | |
|---|---|
| **Feature ID** | F07 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (properties), F06 (tasks overlay), F02 (authz); used by F11 (maintenance), F25 (agent) |
| **Spec references** | SPEC §7.9, §11; `input/views/calendar.jsx`, App. E.12 |

> **Reserved decision, now made (revisitable):** **keep Google Calendar with two-way sync** — *not* native, unlike tasks. Rationale: a calendar's core value is device/phone sync + sharing, which Google does natively and the household already uses (Google Workspace, `kanzen.family`); the tight-coupling argument that drove tasks-native is weaker here. Native event authoring stays possible later. Native **task due-dates are overlaid** read-only; agent **deliveries** also create a Google event.

---

## 1. Purpose & user value
One shared household calendar everyone sees on their own devices — deliveries, maintenance visits, bookings, appointments, staff leave, finance dates — colour-coded and two-way synced with Google Calendar, with agent-created events clearly marked. The operational "when" surface that pairs with tasks (the "what/who").

## 2. Roles & permissions
Resource `calendar`/`calendar_event` (property-scoped, F02):
- **Principal / Manager** — `write`: create/edit events, manage calendars.
- **Staff** — `read` their property's calendar + write their own leave; scoped.
- Sensitive events (e.g. finance) follow F02 visibility.

## 3. Data model
`V__calendar.sql`:

- **`calendars`** — `id uuid pk`, `owner_id`, `google_calendar_id text`, `name text`, `property_id uuid null` (one per property + a shared household calendar), `color text`, `sync_token text null` (Google incremental sync), `watch_channel jsonb null` (push channel + expiry), `created_at`.
- **`calendar_event_refs`** — `id uuid pk`, `owner_id`, `calendar_id → calendars`, `google_event_id text`, `etag text`, `title text`, `start_at timestamptz`, `end_at timestamptz null`, `all_day bool`, `timezone text`, `category text` (`delivery`/`maintenance`/`booking`/`hr`/`finance`), `color text`, `property_id uuid null`, `source_type text` (`agent`/`maintenance`/`manual`/`leave`/`task`), `source_id uuid null`, `updated_at`, `deleted_at null`. The platform mirrors Google events it cares about; Google remains the system-of-record for the *event*, the platform owns the *linkage* (source → event).

## 4. API (Tapir endpoints)
- `GET /api/calendar/events?from&to&calendar&category` — merged view (Google-synced events + native task overlay).
- `POST /api/calendar/events` (create → pushes to Google) · `PATCH /:id` · `DELETE /:id` (both sync to Google).
- `GET /api/calendars` · `POST /api/calendars` (create/link a Google calendar) .
- `POST /api/calendar/sync` (manual incremental sync) · `POST /api/calendar/google/webhook` (Google push notification → incremental pull).
- Task overlay comes from `GET /api/tasks/calendar` (F06), merged client-side or server-side.

## 5. UI / screens & states
Per `calendar.jsx` + App. E.12:
- **Week / Month / List** views; date nav + "Today"; **New event**.
- **Legend**: Delivery / Maintenance / Booking / HR / Finance (colour-coded); "N events from agent" with the agent ribbon; agent-created events show a dot.
- Week = day headers + all-day row + positioned hour-grid events; Month = 6×7 grid (today marker, ≤3/cell); List = 30-day rows.
- **Task overlay**: native due tasks appear as a distinct read-only layer (toggle).
- **States**: syncing, synced (last-sync time), sync-error/re-auth needed, empty.

## 6. Business rules & validation
- **Two-way sync**: app writes push to Google (create/update/delete); Google changes pull via **watch channel webhook** + **incremental `syncToken`**; periodic full reconcile if the token expires. **Conflict resolution**: last-write-wins guarded by `etag`; on conflict, Google wins for externally-edited events, app wins for app-sourced.
- **Source pairing**: a maintenance plan (F11) creates/updates its calendar event; an agent **delivery** creates both a calendar event **and** a native task (F06), kept paired; staff **leave** (F10) creates an all-day event.
- **Timezones**: events carry tz (London/Singapore); rendering respects viewer locale.
- **Recurring events**: Google RRULE honoured (read + write-through).
- **Categories/colours** map to the legend; configurable.
- **Native tasks** are overlaid, **not** written to Google by default (except agent deliveries / explicitly scheduled tasks).

## 7. Integrations / external systems
- **Google Calendar API** via the **same Google service account + domain-wide delegation** as Gmail (F25), narrow scope. Watch channels for push; `syncToken` for incremental pulls; secrets in Secrets Manager.
- **Calendars**: one per property + a shared household calendar under `kanzen.family`.

## 8. Edge cases
- `syncToken` expiry / 410 → full resync.
- Watch-channel expiry → renew before lapse; fall back to polling.
- Event edited in Google and app simultaneously → etag conflict → resolve per rule, audit.
- Delete in Google for a source-linked event (e.g. maintenance) → app re-creates or flags (don't silently lose the maintenance visit).
- DST/timezone across London/Singapore.
- Service-account auth revoked → re-auth prompt; calendar read-only until restored.
- Duplicate event (app create + Google echo) → dedup by `google_event_id`.

## 9. Acceptance criteria
- **AC1** An event created in Kanzen appears in Google Calendar (and on devices) within sync latency, and vice-versa.
- **AC2** Week/Month/List render colour-coded events with the legend; agent events show the ribbon/dot.
- **AC3** An agent delivery creates a paired calendar event + native task.
- **AC4** A maintenance plan's visit shows on the calendar and re-creates if deleted in Google.
- **AC5** Native due tasks overlay read-only and toggle off.
- **AC6** Staff sees only their property's calendar + their leave.
- **AC7** `syncToken` expiry triggers a clean full resync with no duplicates.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG; Google Calendar API mocked): push→Google + pull-via-syncToken; conflict/etag resolution; watch-webhook handling; token-expiry full resync; source-pairing (maintenance/delivery/leave); dedup.
- **Web**: Vitest for week/month/list rendering + legend + task overlay; Playwright e2e create-event (mocked Google) + agent-event styling.

## 11. Observability & audit
- Audit: event create/edit/delete (app-originated), calendar link/unlink, re-auth.
- Metrics: sync lag, webhook receipt rate, token-expiry resyncs, conflict rate, events by category.

## 12. Open questions / decisions
1. **Calendar-native reconsideration** — keep this revisitable; if device-sync proves unnecessary, a native calendar (mirroring tasks) is a later option.
2. **Calendars topology** — one shared household calendar + per-property, vs per-person calendars + overlays.
3. **Which native tasks push to Google** — only deliveries/scheduled, vs all due tasks (noise trade-off).
4. **Staff leave source** — calendar event from F10 HR vs entered directly in calendar.
