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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Two-way sync: app→Google and Google→app**  ‹maps: `CalendarSyncIT.roundTrip`, web `calendar.spec` sync›
- **Given** the Google Calendar API is configured for the Wardian calendar
- **When** Lorna creates an event in Kanzen
- **Then** the event appears in Google Calendar (on all linked devices) within sync latency, with the correct title/time/timezone
- **And** when the event is edited in Google, the incremental `syncToken` pull brings the update back into Kanzen (last-write-wins per etag).

**AC2 — Calendar views render with colour-coded legend and agent ribbon**  ‹maps: `CalendarRenderIT`, web `calendar.spec` views, mobile `calendar_test.dart`›
- **Given** a calendar with events across all five categories (Delivery/Maintenance/Booking/HR/Finance)
- **When** Toby opens the Week, Month, and List views
- **Then** each event is rendered in its category colour and the legend maps correctly
- **And** agent-created events show the agent ribbon/dot marker.

**AC3 — Agent delivery creates paired calendar event + native task**  ‹maps: `AgentDeliveryPairIT`, web `calendar.spec` agent-delivery›
- **Given** The Agent processes a delivery email
- **When** the delivery is ingested
- **Then** both a `calendar_event_ref` (category `delivery`) and a native task (F06, `source_type='agent'`) are created and cross-linked via `source_id`
- **And** deleting one prompts about its pair — neither is silently orphaned.

**AC4 — Maintenance plan visit shows on calendar and re-creates if deleted in Google**  ‹maps: `MaintenanceCalendarIT`›
- **Given** an active maintenance plan (F11) with a calendar event
- **When** someone deletes the event directly in Google
- **Then** the app detects the deletion on next sync and **re-creates** the event (the plan is the authoritative source)
- **And** the event is flagged with `source_type = 'maintenance'` so the guard fires.

**AC5 — Native task overlay is read-only and toggleable**  ‹maps: `TaskOverlayIT`, web `calendar.spec` task-overlay›
- **Given** tasks with `due_at` values in the current week
- **When** Lorna opens the Calendar week view with the task overlay enabled
- **Then** due tasks appear as a distinct read-only layer (no Google write for standard tasks)
- **And** toggling the overlay off hides all task dots without affecting Google-synced events.

**AC6 — Staff scope: Siti sees only Singapore calendar (negative)**  ‹maps: `CalendarScopeIT`, web `calendar.spec` scope, mobile `calendar_test.dart`›
- **Given** Siti is Singapore-Staff
- **When** she opens the Calendar
- **Then** she sees only Singapore property events and her own leave
- **And** a direct request for a Wardian calendar or event returns **403/404** — existence not leaked.

**AC7 — syncToken expiry triggers clean full resync with no duplicates**  ‹maps: `CalendarFullResyncIT`›
- **Given** the stored `syncToken` has expired (Google returns HTTP 410)
- **When** the next sync runs
- **Then** a full resync is performed; all events are re-imported by `google_event_id` dedup
- **And** no duplicate `calendar_event_ref` rows are created and the new `syncToken` is stored.

**AC8 — Service-account auth revocation surfaces a re-auth prompt**  ‹maps: `CalendarAuthErrorIT`, web `calendar.spec` sync-error›
- **Given** the Google service-account delegation has been revoked
- **When** a sync is attempted
- **Then** the calendar shows a **sync-error / re-auth needed** state in the UI (not a silent failure)
- **And** all pre-existing events remain readable (read-only) until auth is restored.

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
