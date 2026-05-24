# Feature F34 — Event backbone (domain events, queue, consumers & notifications)

| | |
|---|---|
| **Feature ID** | F34 |
| **Milestone** | M0.5 (foundational; built early, consumed by everything) |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | F00 (infra); **unifies** F00 audit, F06 notifications, F11 reminders, F28 search index, F18 ledger |
| **Spec references** | SPEC §13; mirrors Hypervolt **Pulsar** + `athena-consumer`; user request (this turn) |

> **Decisions (revisitable):** every meaningful action emits a **unified, serialized domain event** via a **transactional outbox** (Postgres) → **Apache Pulsar** (mirror Hypervolt's docker-compose + consumer pattern) → independent, idempotent **consumers**. Consumers deliver **notifications/push (APNs/FCM)**, index search, post the ledger, write audit, update learned memory, and schedule reminders. **At-least-once, ordered per aggregate.** This is the single reactive spine; "notify me when someone completes a task / leaves a comment" is a subscription, not bespoke code.

## 1. Purpose & user value
One stream that everything reacts to. Staff get an Apple push when assigned a task; the Principal is pinged when a task is completed or commented; an out-of-stock product becomes a buy request; an approval lands instantly. Because it's unified and serialized, *any* future consumer (a new notification rule, an export, an automation) just subscribes — no feature has to know about the others.

## 2. Roles & permissions
System-level infrastructure. Users manage their **notification subscriptions** + register **devices**; events carry `owner_id`/`property_id` and consumers honour F02 (a notification never reveals data the recipient can't see).

## 3. Data model
`V__events.sql`:
- **Unified envelope** (serialized JSON, schema-versioned): `{ event_id, type, occurred_at, actor:{type,id}, subject:{type,id}, owner_id, property_id?, payload, schema_version, correlation_id, causation_id }`.
- **`event_outbox`** — `id, aggregate_type, aggregate_id, type, envelope jsonb, occurred_at, published_at null, attempts int` — written **in the same DB transaction** as the domain change; a relay publishes to Pulsar (guarantees no lost events).
- **`notification_subscriptions`** — `id, owner_id, user_id, event_type_pattern text (e.g. 'task.completed', 'task.comment.*'), channels jsonb (in_app|email|push), filter jsonb (priority/property/mentions_me/assignee), active`.
- **`device_tokens`** — `id, user_id, platform ('apns'|'fcm'|'webpush'), token, last_seen_at, created_at`.
- **`notifications`** (F06, extended) — the in-app record + per-channel delivery status.

## 4. API
- Producers use an internal `emit(event)` helper (writes the outbox in-tx). 
- `GET/POST/PATCH/DELETE /api/notification-subscriptions` · `POST /api/devices` (register push token) · `GET /api/notifications` · `POST /api/notifications/:id/read`.
- (Pulsar topics/consumers are internal; no public event API in v1.)

## 5. UI / screens & states
- **Settings → Notifications**: per-user subscriptions (which events, which channels: in-app / email / push), quiet hours; device management.
- **In-app notification center** (bell in the top bar, F00 shell): list, read/unread, deep-link to the subject.
- **Push** (APNs/FCM via F31 + web push): deep-links into the app.
- States: delivered/read, channel failures, no-devices.

## 6. Business rules & validation
- **Transactional outbox** → no event lost if the domain write commits; relay is at-least-once; **consumers are idempotent** (dedup by `event_id`) and **retryable** (DLQ on repeated failure).
- **Ordering** per `aggregate_id` (Pulsar key-shared).
- **Schema-versioned envelope**; additive evolution; consumers tolerate unknown fields.
- **Consumers** (independent subscriptions): **NotificationFanout** (→ in-app + SES email + **APNs/FCM push** per subscriptions/prefs, F02-filtered), **SearchIndexer** (F28), **LedgerPoster** (F18), **AuditWriter** (F00), **LearnedMemory** (F13/F27 on confirmations), **ReminderScheduler** (F11), optional **MirrorExporter** (Todoist/Vikunja).
- **Event taxonomy** (versioned, e.g.): `task.created|assigned|completed|reopened`, `task.comment.added`, `expense.submitted|approved|rejected`, `list_item.proposed|approved`, `product.out_of_stock|low`, `asset.event.logged`, `agent.action.proposed|executed`, `reconciliation.suggested`, `bill.variance_flagged`, `vendor.compliance.expiring`, `reminder.due`, `backup.completed`.
- **Notifications honour permissions**: a recipient only ever sees subject data they're entitled to (F02); content is trimmed accordingly.

## 7. Integrations / external systems
- **Apache Pulsar** — mirror Hypervolt (docker-compose service + consumer app + Consul DNS `pulsar.service`); SETUP adds it (infra). 
- **APNs + FCM** (SETUP B6) for push; **SES** for email; consumed by F28/F18/F00/F11/F13.

## 8. Edge cases
Outbox relay crash (resume from unpublished); duplicate delivery (consumer dedup); ordering across aggregates (per-key only); Pulsar down (outbox buffers, backpressure); push token expiry/rotation; notification storms (batch/coalesce + quiet hours); schema evolution (versioned); backfill/replay for a new consumer; permission change between emit and deliver (re-check at delivery).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Task completion triggers in-app + push notification to the Principal**  ‹maps: `TaskCompletedEventIT`, web `notifications.spec` in-app-bell›
- **Given** Toby is subscribed to `task.completed` (in-app + push) and Marcia has an assigned task at Wardian
- **When** Marcia completes the task
- **Then** a `task.completed` event is emitted in the unified envelope; Toby receives an in-app notification (bell count +1) and a push notification (APNs)
- **And** the push deep-links to the completed task in the web/mobile app.

**AC2 — Staff member is APNs-pushed on task assignment and comment**  ‹maps: `TaskAssignPushIT`, mobile `PushAssignTest`›
- **Given** Marcia's device is registered and she is subscribed to `task.assigned` and `task.comment.added`
- **When** Lorna assigns a task to Marcia and later adds a comment
- **Then** Marcia receives two APNs pushes (one per event), each with the correct deep-link
- **And** the unified event envelope for each contains the correct `actor`, `subject`, `owner_id`, and `property_id`.

**AC3 — Outbox atomicity: domain write and outbox row commit together; relay resumes after crash**  ‹maps: `OutboxAtomicityIT`›
- **Given** the relay is killed mid-flight after the domain write commits but before Pulsar receives the event
- **When** the relay restarts
- **Then** it resumes from the unpublished outbox row and publishes the event exactly once (at-least-once + consumer dedup)
- **And** no event is lost; the domain row and its outbox row are always in sync.

**AC4 — Consumer failure retries and dead-letters without blocking other consumers**  ‹maps: `ConsumerRetryDLQIT`›
- **Given** the SearchIndexer consumer throws on a specific event
- **When** the retry limit is exhausted
- **Then** the event is moved to the DLQ; other consumers (NotificationFanout, AuditWriter) continue processing normally
- **And** the failing event is idempotent — replaying it from the DLQ does not create duplicates.

**AC5 — Notifications are F02-trimmed; recipients never see data they cannot access (negative)**  ‹maps: `NotificationPermissionIT`, mobile `NotificationTrimTest`›
- **Given** a `bill.variance_flagged` event that includes financial details
- **When** the NotificationFanout consumer fans out to Marcia (Staff — no finance visibility)
- **Then** Marcia receives no notification for this event (filtered by subscription + F02)
- **And** if a notification is sent to a Manager, the content excludes Principal-private fields (valuations stripped).

**AC6 — product.out_of_stock event triggers a Lists buy request**  ‹maps: `ProductOutOfStockIT`, web `lists.spec` buy-request›
- **Given** a product in Wardian's Lists (F08) is marked out of stock
- **When** `product.out_of_stock` is emitted and the Lists consumer processes it
- **Then** a buy request appears in the Wardian shopping list (F08)
- **And** the event is idempotent — a second `out_of_stock` event does not create a duplicate buy request.

**AC7 — Notification preferences and quiet hours are respected**  ‹maps: `NotificationPrefsIT`, web `notifications.spec` quiet-hours›
- **Given** Toby has configured quiet hours (23:00–07:00) and disabled email for `task.completed`
- **When** a task completes during quiet hours
- **Then** the in-app notification is queued but no push or email is sent during the quiet window
- **And** the notification is delivered after quiet hours end; the subscription record is audited on change.

## 10. Test plan
Backend (weaver + testcontainers-PG **+ Pulsar**): transactional-outbox atomicity + relay resume; per-aggregate ordering; consumer idempotency + retry/DLQ; notification fan-out across channels + **permission-trimming**; push token handling (APNs/FCM mocked); schema-version tolerance; replay/backfill.

## 11. Observability & audit
Audit: subscription + device changes. Metrics: events/sec by type, outbox lag, publish/consume latency, consumer error/DLQ rates, push delivery success, notification read rates.

## 12. Open questions
1. **Pulsar vs lighter** (SNS/SQS or Postgres-LISTEN) — recommend **Pulsar** to mirror Hypervolt; confirm. 2. Event **schema registry** (JSON Schema/Avro for the envelope payloads) — Avro fits *here* (the stream), unlike per-record fields. 3. Per-event retention/replay policy. 4. Quiet-hours / digest batching defaults.
