# F48 — Realtime pipeline (websocket + chat substrate)

**Status**: 🟡 Spec — 2026-05-30. Plumbing for live conversation, mentions-as-they-happen, presence, and any future chat surface. Rides the F34 event backbone — every emit is one realtime push away.

**Reads as**: a single websocket carrying typed, authz-filtered domain events; consumers on the client invalidate TanStack Query caches and re-render. No new sync model — the events flowing through F34 *are* the realtime stream.

---

## 1. Why now

Today the CollabPanel polls / invalidates on mutation. That's fine for the author's own write (optimistic), but it's **wrong** for "Lorna mentioned you in a comment on the Range Rover thread two seconds ago" — that needs to land on Marcia's UI within ~100ms, not on next page load.

The F34 sweep we're executing right now is laying down exactly the right substrate: `comment.created`, `comment_mentioned`, `email_thread.assigned`, `task.assigned`, `calendar_event.created` are already (or are about to be) on the outbox. A realtime consumer that pushes filtered envelopes to the relevant browser is the natural fan-out.

## 2. Libraries — what we use, what we don't

### 2.1 Transport
**Backend: http4s native WebSocket support.** Already in the stack (`org.http4s.server.websocket.WebSocketBuilder`). No new dep.

**Frontend: the browser's native `WebSocket`** wrapped in a small reconnect helper. No `socket.io` — heavier, and we don't need the polling fallback (modern browsers + our prod target environments all support WS natively, and CloudFront / ALB handle WS upgrade fine).

### 2.2 In-process fan-out (sandbox)
**`cats.effect.std.Topic[IO, Envelope]`** — the canonical cats-effect pub/sub. One `Topic` per running JVM; each subscriber gets a `Stream[IO, Envelope]`. Bounded queue per subscriber → backpressure or drop policy explicit.

### 2.3 Cross-process pub/sub (production)
**Pulsar** — already on the operator-gated track (W9 §12). The F34 spec sequences PulsarBridge as a consumer of `event_outbox`. The realtime hub subscribes to the Pulsar topic instead of the in-process `Topic` when running with > 1 backend instance. Same `Envelope` shape end-to-end.

### 2.4 Chat UI components
**Hand-rolled** on top of `<CollabPanel>` (already does composer + emoji + @mentions + edit), extended with **streamed updates** + presence dots. Reasons:
- Existing OSS chat-UI kits (e.g. `chatscope/chat-ui-kit-react`, `react-chat-elements`) are built for SaaS-style messengers and would re-implement composer/avatar/emoji we already own.
- The Lexical-based reply composer (W9.4a) is already in production. Adding it to chat surfaces is one prop, not a refactor.
- Chat UI in Kanzen lives *inside* CollabPanel (per-entity threads), not as a global app — generic kits assume a global "chats list" + "current chat" model that doesn't map cleanly.

### 2.5 Presence / typing (later)
**Yjs / Liveblocks / Pusher** — explicitly rejected for v1. Overkill for "is Lorna typing in this thread". A 15s `presence.heartbeat` event from the client with `{currentEntity, typing}` is enough.

## 3. Architecture

```
   write site                  F34 outbox (durable)            in-process Topic           websocket
   ─────────                   ────────────────────             ────────────────            ─────────
   DomainWriter.write(…)  ──►  event_outbox row     ──►  Relay tails + emits to Topic ──►  RealtimeHub
                                                                                            (per connection)
                                                                                                │
                                                                                                ▼
                                                                                          authz filter
                                                                                                │
                                                                                                ▼
                                                                                          ws.send(envelope)
                                                                                                │
                                                                                                ▼
                                                                                       Browser → useRealtime hook
                                                                                                │
                                                                                                ▼
                                                                                       TanStack Query invalidate
                                                                                                │
                                                                                                ▼
                                                                                           React re-renders
```

### 3.1 The hub

`com.kanzen.realtime.RealtimeHub` — one cats-effect `Topic[IO, Envelope]`, shared by:
- **Producer side** — `EventRepo.emit` writes the row AND publishes to the Topic (best-effort; on Topic failure the row is still durable and the Relay re-publishes from the outbox).
- **Consumer side** — each websocket connection subscribes to the Topic, filters envelopes through the per-connection `Authz`, and `ws.send(envelope.toJson)`.

In production with multiple backend instances, the in-process `Topic` is replaced by a Pulsar subscription so every instance fans out the same envelope.

### 3.2 Per-connection state

```scala
final case class Conn(
  userId: UUID,
  tenantId: UUID,                       // (F45 — once multi-tenancy lands)
  authz: Authorizer,                    // cached at handshake; refreshed on role change events
  currentEntity: Option[(String, UUID)],// what the client is viewing (for tighter filtering)
  cursor: Long                          // last event seq the client confirmed
)
```

A handshake message lets the client publish their `currentEntity` so we can prioritise relevant pushes (the hub still considers all events authz-wise — the client hint is just a relevance scoring signal).

### 3.3 The envelope

We reuse the F34 `Envelope` *verbatim* — `{eventType, subject, actor, ownerId, propertyId?, payload, schemaVersion}`. No second wire format. Clients understand event types via the same constants the backend uses (a tiny `web/src/realtime/events.ts` mirroring `Events.scala` — or codegen later).

### 3.4 Authz — every push filtered

For every envelope the hub gets from the Topic:
1. **Tenant gate** (F45): drop if `envelope.tenantId != conn.tenantId`.
2. **Subject view-check**: drop if `conn.authz.can(<subject.type>:view)` fails for the action.
3. **Resource-level scope**: for `email_thread` apply mailbox visibility tier (W9.4 RBAC); for `expense.*` apply Principal-private; etc.

If filtered out: silent. No "you've been denied an event" probe (information leak).

### 3.5 Reliability

- **Durable**: every envelope is in `event_outbox` before the client gets it. Hub push is best-effort, but the Relay re-tries from durable until success.
- **Resumption**: the client sends `subscribe {since: <cursor>}` on connect; the server replays unpublished events from `event_outbox` whose `created_at` > the cursor. After catchup, the client receives the live tail. **A reconnect after a 5-minute Wi-Fi drop catches up.**
- **Backpressure**: per-connection bounded buffer (256 events). If the client is too slow → drop a `lag_warning` event + cut the connection (client will reconnect with `since`).
- **Heartbeats**: ping every 25s; client `pong` within 10s or the connection is reaped.

### 3.6 Client side

`web/src/realtime/useRealtime.ts`:
```ts
useRealtime(({eventType, subject, payload}) => {
  if (eventType === "comment.created" && subject.type === entityType && subject.id === entityId) {
    qc.invalidateQueries({ queryKey: ["collab-comments", entityType, entityId] });
  }
  // … per-event handlers
});
```

A small per-feature handler registry — the CollabPanel registers `comment.{created,edited}` for its entity; the inbox registers `email_thread.assigned` for the user; the bell registers `comment_mentioned` for the user. Each handler is small and local; no global event router.

Reconnection: the wrapper holds the last seen `cursor` in `sessionStorage` so a tab reload resumes without dropping recent events.

## 4. Chat-as-a-surface

The "live convo" UX uses the same `<CollabPanel>` everywhere (inbox thread, asset detail, task detail). The realtime layer makes:
- **New comments** appear without a refresh (someone else's reply lands while you're reading).
- **Edits** propagate live ("edited" badge appears).
- **@mention** notifications bell-pings the recipient instantly.
- **Presence** dots on the avatar rim of users actively viewing the same entity (later).
- **Typing indicators** ("Lorna is typing…") via the `presence` event family (later).

For pure DM-style 1:1 / N:N chat (not tied to a domain entity), we open a new `entity_type = 'chat'` on `entity_comments` + `entity_links` (members) and the same CollabPanel renders. The realtime layer treats it as any other entity.

## 5. The slices

### 5.1 W10-RT.1 — substrate (sandbox)
- `com.kanzen.realtime.RealtimeHub` (Topic + per-connection IO loop).
- `GET /api/ws` (http4s endpoint) — bearer-auth handshake → upgrade → push loop.
- `EventRepo.emit` also publishes to the Topic.
- Client `useRealtime` hook + reconnect wrapper + cursor persistence.
- An e2e: two browser sessions; A comments on a thread; B sees it within 500ms with no manual refresh.

### 5.2 W10-RT.2 — wire the existing surfaces
- CollabPanel handles `comment.{created,edited}` for its entity.
- Inbox thread list handles `email_thread.{assigned,status_changed,replied}`.
- Notifications bell handles `comment_mentioned` + `task.assigned` for the user.
- Calendar handles `calendar_event.{created,updated,deleted}` for the current window.

### 5.3 W10-RT.3 — presence (small)
- `presence.heartbeat` event from the client every 15s with `{currentEntity, typing}`.
- Hub maintains an ephemeral `Map[(entityType, entityId), Set[userId]]`.
- Pushes `presence.snapshot` periodically + on change.
- Avatars on the entity get a small "live" indicator with the colour-glow (F47).

### 5.4 W10-RT.4 — DM-style chat (later)
- `entity_type = 'chat'` rows in `entity_comments`; members in `entity_links`.
- A `/chat` page lists the user's threads; clicking opens a CollabPanel on it.
- Optional: a `chat.created` event to populate the recipient's threads list live.

### 5.5 W10-RT.5 — Pulsar bridge (operator-gated)
- Swap the in-process `Topic` for a Pulsar subscription so multi-instance backends fan out the same envelope. Same client wire format.

## 6. Production properties

- **At-least-once delivery**: clients dedupe by `(eventType, subject.id, occurredAt)` server-stamped sequence. Idempotent handlers (TanStack invalidations are idempotent).
- **Auth refresh**: when the user's role changes (`user.role_changed` event), the hub re-reads `Authorizer` for that connection. Token expiry triggers a clean disconnect + reconnect with the new token.
- **Backpressure visible**: lag warnings show as a small "Catching up…" pill in the top-bar; never silent.
- **No PII leak via heartbeat**: presence carries only entity ids the recipient can already see; we don't broadcast "Lorna is viewing the Wealth page" to someone without `wealth:view`.

## 7. Tests

- **`RealtimeHubSpec`** (FreeSpec) — push → multi-subscriber fan-out; authz filter drops correctly; cursor resumption replays exactly the right window.
- **`RealtimeAuthzIT`** — Marcia (staff) subscribes; an event on a Principal mailbox emits; her socket does NOT receive it.
- **`RealtimeReconnectIT`** — client disconnects, server emits 5 events, client reconnects with `since` cursor → receives exactly those 5 in order.
- **e2e (Playwright)** — two browser contexts; A posts a comment on Eleanor's thread; B sees it without refresh within 1s.

## 8. Operator + cost implications

- **Sandbox / dev**: no new infra. http4s WS + in-process Topic.
- **Production**: WS termination on ALB or CloudFront — both support natively. **Connection cap per backend**: ~10k concurrent on a single t3.medium with our payload shape. Plenty of headroom for household-scale.
- **Pulsar**: ships with the operator-gated track. Adds one dependency (Apache Pulsar broker — managed via DataStax Astra Streaming or self-hosted).

## 9. Out of scope (deliberately)

- Voice / video chat (WebRTC, signalling). Different domain.
- CRDT-based collaborative editing of comment bodies (yjs). Comments are short and single-author; edits are sequential.
- A dedicated "Inbox & DMs" sidebar. Chat lives inside CollabPanel for now; DMs as a separate page in W10-RT.4.
- E2E encryption between users. We're a single-tenant trust boundary; the server reads and authorises everything (and stores it durably).

## 10. Definition of Done

- A single websocket per browser session, authenticated by JWT at handshake.
- Every F34 event reaches every authorised client within 250ms p95 in dev.
- The CollabPanel updates without a manual refresh when someone else comments / edits.
- A reconnect after a network hiccup resumes from the last seen cursor with no data loss.
- The notifications bell pings the recipient on `comment_mentioned` instantly.
- Authz filter has its own no-leak IT and is exercised in CI.
