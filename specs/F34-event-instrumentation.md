# F34 — Unified event pipeline (instrumentation pass)

**Status**: 🟡 Spec — 2026-05-30 (not yet executed). The F34 backbone is built; this spec finishes the producer side so *every* meaningful domain write publishes a typed event, and lays out the subscriber roadmap.

**Reads as**: an extension to the existing F34 backbone, not a new feature. The architecture isn't changing — the *instrumentation reach* is.

---

## 1. Why now

Today the F34 backbone is real but massively under-used. Concrete audit (2026-05-30):
- `Envelope` + `EventRepo.emit` + `event_outbox` (JSONB payload) + `Relay` + `Consumer` trait + `NotificationFanout` + `IndexConsumer` all present (`backend/src/main/scala/com/kanzen/events/*`).
- **Total `EventRepo.emit` call sites**: 4 — `Collab.scala:174` and `:228` (`comment_mentioned` on add + edit), `Tasks.scala:183` (one task event), `AssetEventRepo.add`. Everything else (asset moves, expense submits, calendar create/update/delete, document upload, list item approve, role grants, …) audits but **does not emit**.
- The consumers that exist (notifications, RAG indexing) are effectively starved.

The fix is mechanical: instrument every domain write. The cost of *not* doing it is that every future consumer (GCal sync for W9.5, mobile push, audit propagation, future Pulsar bridge) will need to grep producers and add ad-hoc emits — drift forever.

## 2. Target architecture (already designed; restated for the contract)

- **A single global durable queue** — `event_outbox` (Postgres JSONB). No new tech. Avro/Protobuf are deferred until the operator-gated Pulsar bridge ships (it'll do the serialisation at the bridge boundary; producers stay in JSONB).
- **A typed `Envelope`**:
  ```scala
  final case class Actor(`type`: String, id: Option[UUID])  // user | system | agent
  final case class Subject(`type`: String, id: UUID)         // the aggregate
  final case class Envelope(eventType: String, subject: Subject, actor: Actor,
                            occurredAt: Instant, payload: Json)
  ```
- **Producers** call one thing: `EventRepo.emit(env)`. It runs inside the same `ConnectionIO` as the write — tx-safe (no write-without-event, no event-without-write).
- **Consumers** are `Consumer[Envelope]`. `Relay` polls `event_outbox.published_at IS NULL`, hands each envelope to every consumer in registration order, and marks published on full-fan-out success. (Today this is in `Relay.scala`; confirm error semantics + retry shape in the consumer-side review under §6.)
- **Subscribers fan out** without producers knowing which exist. This is the architectural property the user is asking us to honour.

## 3. The taxonomy (the producer contract)

Stable verb sets per domain. `subject.type` = the aggregate kind. Payload schemas live alongside each event in code (Circe encoders); a sample payload is documented per type.

> **Naming rule**: `<aggregate>.<verb>` — lowercase, dot-separated, past tense. Use **`_`** in payload field names, **`.`** in event types only.

### 3.1 Registry (W1, W3)
- `asset.created`, `asset.updated`, `asset.archived`
- `asset.moved` *(payload: `{from_location_id, to_location_id, moved_by, note}`)*
- `asset.custody_changed` *(payload: `{from_status, to_status, changed_by, note}`)*
- `asset.set_hero` *(payload: `{document_id}`)*
- `asset.restructured` *(payload: `{op: "split"|"merge", parent_ids, child_ids}`)*
- `asset.tagged`, `asset.untagged`
- `asset_event.logged` — lifecycle event (service, valuation event row, etc.)
- `collection.*` — created, updated, archived, member_added, member_removed
- `group.*` — created, member_added, member_removed

### 3.2 Property / Bible (W4)
- `property.created`, `property.updated`, `property.archived`
- `location.created`, `location.moved`, `location.deleted`
- `defect.raised`, `defect.assigned`, `defect.transitioned`, `defect.resolved`

### 3.3 Finance (W5)
- `bill.created`, `bill.approved`, `bill.paid_marked`, `bill.scheduled`
- `expense.submitted`, `expense.approved`, `expense.rejected`
- `payment_method.created`, `payment_method.archived`
- `reconciliation.suggested`, `reconciliation.confirmed`, `reconciliation.unmatched`
- `receipt.created`, `receipt.parsed`, `receipt.line_resolved`
- `ledger.posted` *(one per balanced posting set)*

### 3.4 Wealth (W7)
- `wealth_account.created`, `wealth_account.balance_updated`
- `holding.opened`, `holding.closed`, `holding.dividend_recorded`
- `valuation.recorded`
- `trade.executed` *(payload: `{security_id, qty, price_minor, currency, realised_gain_minor?}`)*

### 3.5 Operations (W6)
- `task.created`, `task.assigned`, `task.completed`, `task.cancelled`, `task.commented` *(extends today's single Tasks emit)*
- `list.created`, `list.item_proposed`, `list.item_approved`, `list.ordered`
- `maintenance.scheduled`, `maintenance.completed`
- `supply.replenished`
- `calendar_event.created`, `calendar_event.updated`, `calendar_event.deleted` *— **needed first** for Path B GCal sync*

### 3.6 Comms (W9 — collaborative inbox)
- `email_thread.received`, `email_thread.assigned`, `email_thread.status_changed`, `email_thread.replied`
- `email_proposal.proposed`, `email_proposal.confirmed`, `email_proposal.rejected`
- `comment.created`, `comment.edited`, `comment_mentioned` *(already exists; align name)*
- `link.created`, `link.deleted`

### 3.7 People & roles (F02v2)
- `person.created`, `person.updated`, `person.archived`
- `user.role_changed`
- `user.impersonated_started`, `user.impersonated_stopped`
- `role.created`, `role.permissions_changed`
- `team.created`, `team.member_added`, `team.member_removed`

### 3.8 System / agent (F25–F27, F30)
- `document.uploaded`, `document.derived`, `document.deleted`
- `backup.started`, `backup.completed`, `backup.failed`
- `agent.action_proposed`, `agent.action_confirmed`, `agent.action_rejected`

## 4. Producer ergonomics

Two stamps to choose from per call-site:

- **`EventRepo.emit(env)`** — when the writer has a fancy payload that needs custom Circe encoding. (Already used.)
- **`DomainWriter.write[A](audit, eventType, subject, payload)(body)`** — **new helper.** Runs `body: ConnectionIO[A]`, then in the same tx: writes the audit row + emits the envelope. Single import per repo, single line per mutation. Stops drift.

```scala
// com.kanzen.events.DomainWriter
object DomainWriter {
  def write[A](actor: Actor, action: String, eventType: String,
               subject: Subject, payload: Json = Json.Null)
              (body: ConnectionIO[A]): ConnectionIO[A] =
    for {
      a <- body
      _ <- AuditRepo.write(actor, action, subject)
      _ <- EventRepo.emit(Envelope(eventType, subject, actor, Instant.now(), payload))
    } yield a
}
```

> The audit + event pair is what the F34 spec wanted from day one — they're two views of the same truth. Pairing them stops them drifting apart.

## 5. Subscribers (the dispatch map)

### 5.1 Today
- **`NotificationFanout`** — turns events into in-app notifications. Currently knows `comment_mentioned`. Must learn: `task.assigned`, `expense.submitted` (→ principal), `email_thread.assigned`, `defect.raised` etc. Per user notification preferences (in-app vs digest) live on `notification_preferences` (operator-gated digest delivery via SES at W9.5/F34).
- **`IndexConsumer`** — re-renders `entity_documents` for RAG when an indexed aggregate changes. Currently keyed off a handful of types; extend to all `<asset|task|property|person|document>.{created,updated,archived}`.

### 5.2 Planned (sandbox-buildable)
- **`CalendarSyncConsumer`** — `calendar_event.*` → push to the right Google Calendar via the `CalendarSink` seam. Sandbox impl: no-op + log. Live impl (W9.5): Google Calendar API.
- **`GmailSyncConsumer`** — `email_thread.replied` → push reply via Gmail send (the existing W9.4a `EmailSender` seam).

### 5.3 Operator-gated
- **`PulsarBridge`** — fans `event_outbox` rows to a Pulsar topic for downstream consumers (mobile push via APNs/FCM, email digests via SES, future external integrations).
- **`PushConsumer`** — APNs/FCM mobile push for user-targeted events.

## 6. Producer sweep — execution order

Sequenced by user-visible impact and downstream dependency:

1. **Calendar** (`calendar_event.*`) — first, because Path B GCal sync depends on it. One commit, mirror create / update / delete handlers in `Calendar.scala`.
2. **Tasks** (`task.*`) — extend today's single emit. Powers task-assignment notifications.
3. **Comments & links** (`comment.*`, `link.*`) — fold into the existing Collab paths. Already has `comment_mentioned`; add `comment.created`, `comment.edited`, `link.created`.
4. **Inbox threads** (`email_thread.*`, `email_proposal.*`) — emit on assign / status / reply / proposal confirm.
5. **Assets** — the big one. `asset.{created,updated,moved,custody_changed,set_hero,restructured,archived,tagged}` + `asset_event.logged`.
6. **Finance** — bills, expenses, payments, reconciliation, ledger postings.
7. **Properties, Lists, Maintenance, People, Wealth, Documents** — the rest.

One commit per step. Each ends with green `EventEmissionIT` (see §7).

## 7. Guardrails

### 7.1 IT per domain
A `<Domain>EventEmissionIT` per step. Pattern:
```scala
test("creating an asset writes an asset.created event") { xa =>
  for {
    a <- Assets.create(...).transact(xa)
    rows <- sql"select event_type, aggregate_type, aggregate_id from event_outbox where aggregate_id = ${a.id}"
              .query[(String, String, UUID)].to[List].transact(xa)
  } yield expect(rows.exists(_._1 == "asset.created"))
}
```
This is the bar that prevents drift forever. Adding a new mutation that doesn't emit fails its domain's emission IT.

### 7.2 Cross-cutting invariants
- **Tx-safe**: emit is a `ConnectionIO` insert; runs in the same tx as the write. No write-without-event, no event-without-write.
- **Idempotent emission**: one emit per logical mutation. `DomainWriter.write` guarantees this; ad-hoc emits are caller's responsibility.
- **No PII in `event_type`** — payload carries identifiers; `event_type` is the public verb.
- **Principal-private respected** — payloads of financial / receipts / wealth events use ids only; consumers consult `Authz` before fan-out (notifications already do; RAG index already does).
- **No retry storm** — the existing `Relay` handles failure; `retry_count` + exponential backoff if not present today (audit + add in §8).

### 7.3 Performance
- An emit is one row insert. With 20 domains × ~5 events × a busy household, < 50 emits/min. No volume concern.
- Index `event_outbox(published_at) where published_at is null` if not present (for the Relay query).

## 8. Open items / one-time fixes

- ☐ Confirm `event_outbox` schema columns (id, event_type, aggregate_type, aggregate_id, payload, occurred_at, published_at, retry_count, last_error). Add missing.
- ☐ Confirm Relay error handling + retry semantics. Add structured backoff if absent.
- ☐ Decide whether to write the `actor.id` for **system-initiated writes** (agent confirm under principal authz) as the agent id (`agent`) or the human's id. Recommend: `actor = {type: "user", id: human}` with `payload.agent = true` when the agent triggered it. Keeps the audit trail human-centric.
- ☐ Sensitive-payload review for `expense.*`, `ledger.posted`, `valuation.recorded`, `wealth_account.*` — these must not include monetary amounts in fields a non-Principal consumer would see. Index-side already filters; notifications must too.
- ☐ Subscriber preference model — per-user opt-in/out per event family (already in `notification_preferences`?). Confirm and extend.

## 9. Definition of Done (this spec)

- `DomainWriter` helper landed; one-line usage proven by §6 step 1 (Calendar).
- Taxonomy doc consumed by code: each `EventRepo.emit` call site references a constant from a `Events` object (compile-time check that we use the documented verbs).
- §6 sweep complete — every step has its emission IT green.
- `NotificationFanout` + `IndexConsumer` know about the bigger taxonomy.
- `CalendarSyncConsumer` + `GmailSyncConsumer` exist as sandbox no-ops behind a seam, ready for W9.5.
- Spec moved to ✅ in this file's status header.

## 10. Out of scope

- Avro/Protobuf serialisation. JSONB stays. Pulsar bridge does its own boundary serialisation when it ships.
- A new "Events" admin UI. The Audit page already shows the audit trail; we can add an `event_outbox` viewer to Settings → Events later if needed.
- A separate notification preferences UI. F34 spec already covers it.
