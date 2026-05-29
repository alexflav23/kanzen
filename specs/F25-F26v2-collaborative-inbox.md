# Feature F25/F26 v2 — Collaborative Inbox (the flow-of-life surface)

| | |
|---|---|
| **Feature ID** | F25/F26 v2 (supersedes the F25 *email agent* + F26 *unified inbox/triage* sandbox slices; F27 trust unchanged) |
| **Wave** | **W9 — Collaborative Inbox** (the keystone after the W1–W8 core) |
| **Domain** | Agent + Operations (the inbox *is* the operating surface) |
| **Status** | ✍️ **spec FINAL — implementation-ready**. Build deferred until infra is provisioned (Google Workspace + Bedrock + `kanzen.family` DNS); operator-gated. |
| **Depends on** | F02 (agent principal + authz/scope), F05 (docs/S3 + `ObjectStore`), F06 (tasks + `task_links`), F07 (calendar), F08 (lists), F11 (maintenance), F13 (receipts/OCR), F14/F15 (reconcile/bills), F17 (expenses), F04/F19 (assets), F10 (people + `AssigneeScope` + `PersonAvatar`), F27 (trust), F34 (events/notifications) |
| **Spec references** | SPEC §3.6, §7.2, §10.1–10.2; `input/views/inbox.jsx`, `triage.jsx`; the existing `F25-email-agent.md` + `F26-inbox-triage.md` (the engine this builds on) |

> **The vision (owner's words):** *"The biggest feature — the inbox drives the flow of life. Forward emails to inboxes created on the fly; Google runs the email so we don't reinvent it; a client + UI wrapper on top; an AI ingest agent that discerns (a UPS delivery, an expense → a receipt, an Ocado order → an expense/receipt trail on the grocery list, a car-service booking → the car); each thread assignable to a person; each thread turn-into-a-task; a collaborative inbox where a completed task can go away; and all household accounts on `wardian@kanzen.family` so Amazon/groceries/etc. are automatic."*

---

## 0. Decisions (locked)

1. **Real email, Front/Superhuman-grade — not virtual labels.** Kanzen is a *full client* over **real Google Workspace mailboxes** (Gmail API). `wardian@kanzen.family` is a real, sendable mailbox you sign up to Amazon/Ocado with; `deliveries@`, `groceries@`, `vendors@`… are real domain addresses (aliases / a **catch-all**) delivering into the connected mailbox(es). "Created on the fly" = add an alias / rely on catch-all — every address is real RFC822 mail, synced bidirectionally. **Google is the mail server; Kanzen is the client.**
2. **Read *and* send/reply from Kanzen** (Gmail send scope; threaded replies; signatures; **shared drafts**).
3. **Front-grade collaboration**: assign a thread to a person; **internal comments + @mentions**; **shared draft** replies; read/seen indicators; statuses (open · snoozed · done · archived); thread → **task** (F06); done/archive makes it "go away".
4. **AI ingest agent** (the F25 engine, elevated): every inbound message → classify + extract → **typed proposals** (F27 trust — financial/asset **never auto-commit**), surfaced inline in the thread and in the Triage stream.
5. **Spec now, build later** (operator-gated). Build sequenced as **Wave W9** once `SETUP.md` inputs land (§17). The W9 build deliberately lands a **sandbox spine behind the integration seam** first (§18) so every layer is testable before live Gmail/Bedrock.
6. **Hand-roll the UI** (house style, `input/inbox.jsx`/`triage.jsx`), composing the four headless OSS libs in §3 for the hard parts. No third-party webmail shell / UI kit.

---

## 1. Purpose & user value
Turn the household's email into the single collaborative surface the estate runs from: real mail flows in, the agent reads it and proposes the right Kanzen action (receipt, expense, delivery event, list order, car-service on the vehicle), a human confirms, and the thread can be assigned, discussed, turned into a task, and archived when done. **AI proposes; the Principal/Manager decides; Staff get only their threads.** Front/Superhuman for a family office, wired into the registry, finance and operations.

## 2. Roles & permissions (F02)
- **Agent** = system principal (seeded Agent role): ingest, classify, propose; **cannot auto-commit financial/asset** (F27 hard lock); same authz + audit path as humans; **never sends email**.
- **Principal**: all inboxes/threads/streams; trust settings; `mailbox:connect`; send as any granted identity.
- **Manager**: shared inboxes in scope; confirm non-financial (financial → review); assign; comment; send from granted identities.
- **Staff**: **only threads assigned to them** (or in their property's shared inbox), via the existing `AssigneeScope` (own/property) model used by Tasks/Lists; never sees other inboxes, financial proposals, or counts outside scope.

**New catalogue actions** (`com.kanzen.authz.Actions`, F02 v2 — `crud(...)` + verbs, with a legacy-level bridge):
```
crud("inbox")                       // inbox:view (Read), create (mailbox add, Admin), edit, delete
inbox:view (Read) · thread:assign (Write) · thread:status (Write)   // snooze/done/archive
thread:comment (Write) · mail:send (Write) · mailbox:connect (Admin)
```
`thread:view` bridges to `inbox:view`; sending runs as the **acting user** from a granted send-identity; confirming an agent action runs under the actor's authz (a Manager can't confirm what they lack permission to create — carries F26 AC7 forward).

## 3. Open-source building blocks (locked; all headless, StyleX-friendly)
Hand-roll the shell; pull only these for the genuinely hard parts:

| Need | Library | License | Notes |
|---|---|---|---|
| **Render untrusted email HTML safely** | **DOMPurify** + an isolated `<iframe srcdoc>` | Apache-2.0 / MPL-2.0 | Sanitize then render inside a sandboxed iframe (`sandbox="allow-popups allow-popups-to-escape-sandbox"`, no `allow-scripts`) so email CSS never bleeds into the app and no script runs. Strip remote images behind a "load images" toggle (privacy/tracking-pixel control). **Never** inject raw email HTML. |
| **Reply composer + internal comments w/ @mentions** | **Lexical** (`lexical`, `@lexical/react`) | MIT (Meta) | Headless rich text; `@lexical/react` `BeautifulMentionsPlugin`-style mention node for @person; themed entirely via our StyleX tokens. Outbound HTML is produced by Lexical's HTML export, re-sanitized before send. |
| **Virtualized thread list** | **@tanstack/react-virtual** | MIT | Pairs with the TanStack Query we already use; keeps long inboxes smooth. |
| **Keyboard layer (Superhuman feel)** | **tinykeys** | MIT | Tiny declarative bindings; scoped to the inbox route. We already hand-rolled ⌘K, so no `cmdk`. |

We already have: `@tanstack/react-query`, `zod`, `@stylexjs/stylex`, `react-router-dom`, `dinero.js`. **Study, don't fork:** *Inbox Zero* (`getinboxzero`, AGPL — patterns only) for AI-Gmail triage; Front/Missive/Superhuman as product references. **Backend MIME**: Gmail API returns structured payloads (rarely need raw); when needed, JVM **Jakarta Mail** / **Apache Mime4J**.

## 4. Data model (`backend/.../db/migration/V3_0_0__collaborative_inbox.sql` — next major)
Conventions: `uuid` PK `default gen_random_uuid()`; `timestamptz`; `owner_id uuid` on every domain row; soft-delete `deleted_at` where user-deletable; money = `*_minor bigint` + ISO `currency`; jsonb for flexible payloads; Doobie `Meta`/`Read` in `com.kanzen.inbox`. Builds on F25's `incoming_emails`/`agent_actions`: **`email_messages` supersedes `incoming_emails`** (migrate rows; an incoming email *is* an inbound message), and **`agent_actions.email_id` → `agent_actions.message_id`** (FK to `email_messages`).

```sql
-- a connected Workspace identity (one row per real mailbox Kanzen syncs)
create table mail_accounts (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null,
  address         text not null unique,          -- e.g. wardian@kanzen.family
  display_name    text,
  provider        text not null default 'gmail', -- gmail (only, v1)
  gmail_history_id bigint,                        -- incremental-sync cursor
  watch_expires_at timestamptz,                   -- users.watch expiry (renew before)
  scopes          text not null,                  -- granted OAuth scopes
  status          text not null default 'connected', -- connected|reauth|error
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- the addresses surfaced as "inboxes" (created on the fly: aliases / catch-all)
create table mail_inboxes (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references mail_accounts(id),
  owner_id    uuid not null,
  address     text not null,                      -- groceries@, deliveries@, wardian@…
  label       text not null,                      -- display label
  kind        text not null default 'shared',     -- shared|personal|catch_all
  property_id uuid references properties(id),     -- scope (Staff see their property's shared inboxes)
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (account_id, address)
);

create table email_threads (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null,
  gmail_thread_id text not null unique,
  inbox_id       uuid not null references mail_inboxes(id),
  subject        text,
  snippet        text,
  participants   jsonb not null default '[]',     -- [{name,email}]
  message_count  int not null default 0,
  last_message_at timestamptz,
  unread         boolean not null default true,
  has_attachments boolean not null default false,
  status         text not null default 'open',    -- open|snoozed|done|archived
  snoozed_until  timestamptz,
  assignee_id    uuid references employment_records(id), -- the person id space (as tasks/lists)
  created_at     timestamptz not null default now()
);
create index email_threads_inbox_status_idx on email_threads (inbox_id, status, last_message_at desc);
create index email_threads_assignee_idx on email_threads (assignee_id) where status = 'open';

create table email_messages (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null,
  gmail_message_id text not null unique,
  thread_id      uuid not null references email_threads(id) on delete cascade,
  direction      text not null,                   -- inbound|outbound
  from_addr      text,
  to_addrs       jsonb not null default '[]',
  cc_addrs       jsonb not null default '[]',
  subject        text,
  sent_at        timestamptz,
  headers        jsonb not null default '{}',     -- Message-ID, In-Reply-To, References, List-Unsubscribe…
  body_text      text,
  body_html_s3_key text,                          -- sanitized-at-render; raw html stored
  raw_s3_key     text not null,                   -- immutable original RFC822 (sacred)
  is_draft       boolean not null default false,
  sent_by        uuid,                            -- acting user for outbound
  created_at     timestamptz not null default now()
);
create index email_messages_thread_idx on email_messages (thread_id, sent_at);

create table email_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references email_messages(id) on delete cascade,
  document_id  uuid references documents(id),     -- filed as an F05 document
  filename     text not null,
  content_type text,
  size_bytes   bigint,
  scanned      boolean not null default false,
  safe         boolean
);

create table thread_comments (                    -- internal notes; NEVER sent outbound
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references email_threads(id) on delete cascade,
  author_id  uuid not null,
  body       text not null,
  mentions   uuid[] not null default '{}',        -- person/user ids @mentioned
  created_at timestamptz not null default now()
);

create table email_drafts (                       -- shared draft replies
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references email_threads(id) on delete cascade,
  author_id  uuid not null,
  to_addrs   jsonb not null default '[]',
  cc_addrs   jsonb not null default '[]',
  subject    text,
  body_html  text,
  shared     boolean not null default true,
  status     text not null default 'draft',       -- draft|sent|discarded
  updated_at timestamptz not null default now()
);

create table thread_events (                       -- the thread's activity/audit timeline
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references email_threads(id) on delete cascade,
  actor_id   uuid,                                 -- null = agent
  kind       text not null,                        -- received|assigned|status|comment|agent_proposed|action_confirmed|sent|task_created|reauth
  payload    jsonb not null default '{}',
  at         timestamptz not null default now()
);
```
Reuses: **`agent_actions`** (F25; re-keyed to `message_id`), `agent_action_result_link` (provenance), `sender_rules` (F27), `documents`/`document_links` (F05; attachments + thread↔record links), `tasks`/`task_links` (F06; a thread→task link via `task_links target_type='email_thread'`), `merchants` (F12), `audit_log_entries` (every write), `EventRepo` outbox (F34; @mention + proposal notifications).

## 5. Gmail sync architecture (Google is the server)
**Connect** (`mailbox:connect`, Principal): a Workspace **service account with domain-wide delegation** (scopes `gmail.readonly`, `gmail.modify`, `gmail.send`) impersonates each mailbox — one credential for the whole domain; per-mailbox OAuth is the non-Workspace fallback. Persist `mail_accounts` row; kick off backfill + start a watch.

**Inbound (real-time)**:
1. `users.watch(topicName, labelIds=[INBOX])` per mailbox → returns `historyId` + expiry; persist; **renew** ~daily (before the 7-day cap) via a scheduled job.
2. Gmail publishes to a **Pub/Sub** topic → push subscription POSTs to `POST /api/inbox/webhook/gmail` (verified by the Pub/Sub JWT).
3. Handler runs `users.history.list(startHistoryId=mail_accounts.gmail_history_id)` → for each added message: `users.messages.get(format=RAW|FULL)` → **upsert** thread + message (idempotent by `gmail_message_id`/`gmail_thread_id`), store **raw RFC822 → S3** (`raw_s3_key`, immutable), file attachments as F05 documents (malware-scanned → `email_attachments`), advance `gmail_history_id`, emit a `thread_events(received)`, enqueue the **ingest agent** (§6).
4. **Backfill** on first connect: page `users.threads.list`/`messages.list` (bounded window, e.g. 90 days) with the same upsert path.
5. **Poll fallback** (no Pub/Sub): a `IndexReconcile`-style loop calls `history.list` every N seconds.

**Outbound (send/reply)** (`mail:send`, acting user): build a MIME message (re-sanitized Lexical HTML), set `In-Reply-To`/`References` from the thread's latest message → `users.messages.send(threadId=…)` → store the returned message as an **outbound** `email_message` (`sent_by`=user), `thread_events(sent)`, mark the draft `sent`.

**Bidirectional state**: Kanzen status ↔ Gmail labels — `archived/done` removes `INBOX` (+ adds a `Kanzen/Done` label); read clears `UNREAD`; snooze removes `INBOX` until `snoozed_until` then re-adds. **Assignment, comments, drafts are Kanzen-only** (never pushed to Gmail) — exactly like Front. Inbound history reconciles Gmail-side changes (e.g. a reply sent from the Gmail UI appears as a new outbound message).

**Idempotency & ordering**: all upserts keyed on Gmail ids; Pub/Sub redelivery is a no-op; `history.list` is the source of truth for ordering; a per-account advisory lock serialises concurrent webhook runs.

## 6. AI ingest agent (classify → extract → propose)
Per inbound message, run as the **Agent system principal** through `Authz`:
1. **Deterministic rules first** (`sender_rules`, F27; known merchant/domain → category) — cheap, high-precision.
2. **Bedrock/Claude classify+extract** behind the integration seam (`AgentClassifier` trait; **sandbox = a deterministic stub** keyed on subject/sender keywords, mirroring the F32 NL Claude/Bedrock seam). One call returns `{intent, confidence, extracted}` against a **per-intent structured-output schema** (§7). Content stays in-region (eu-west-1).
3. **Map → typed `agent_actions`** (§7 table) with `extracted` payload + `confidence`.
4. **Trust route** (F27, unchanged): non-financial + trusted + `confidence ≥ τ_auto` → auto-execute (audited, agent ribbon, `thread_events(action_confirmed)`); **financial/asset → always `proposed`** (hard lock, regardless of trust); `confidence < τ_review` → `proposed`. Default: **everything proposed, financial locked**.
5. Surface proposals **inline on the thread** + in the F26 Triage stream; `thread_events(agent_proposed)`.

Confidence thresholds `τ_auto`/`τ_review` are config (typesafe-config). Reprocess (`POST /api/inbox/messages/:id/reprocess`) re-runs classify/extract as a new version (original `extracted` preserved for audit).

## 7. Intent taxonomy & extraction schemas → action mapping
Each intent has a Claude structured-output schema and maps to typed `agent_actions` (every financial/asset one **proposed**, never auto):

| Intent | Extract (schema fields) | Action(s) (`agent_actions.type`) | Target feature |
|---|---|---|---|
| **delivery** | `carrier, tracking_no, item?, eta_date, eta_window, address` | `create_event` (delivery window) [+ `create_task` "be in / receive"] | F07 / F06 |
| **receipt** | `merchant, total_minor, currency, date, line_items[]{name,qty,price_minor,category?}, payment_method?` | `create_receipt` + OCR parse + `propose_expense` + `file_document` | F13 / F17 / F05 |
| **grocery_order** | `vendor(=Ocado…), order_ref, total_minor, currency, delivery_slot, line_items[]` | receipt + `propose_expense` **+ `link_list_order`** (append an order to that grocery **List instance**, F08) | F08 / F13 / F17 |
| **invoice** | `merchant, amount_minor, currency, due_date, account_ref, period` | `reconcile_bill` (±15% variance) **or** `propose_bill` | F15 / F14 |
| **service_booking** | `vendor, service_type, asset_hint(reg/make), datetime, location` | `create_event` + `propose_maintenance` **linked to the vehicle/asset**; `assign` | F07 / F11 / F04·F19 |
| **warranty / document** | `product, vendor, expiry_date, asset_hint` | `file_document` + attach to asset + `set_reminder` | F05 / F04 / F11 |
| **travel** | `provider, ref, depart_at, return_at, locations` | `create_event` | F07 |
| **statement** | `institution, period, account_ref` | `file_document` + `set_reminder` | F05 / F11 |
| **generic** | — | none (thread for a human; assign/comment/task) | — |

**Resolution helpers** (sandbox-deterministic, Claude-assisted in prod): `asset_hint` → match `assets` by reg/maker/title (reuse `carSyn` + ilike); `vendor` → `merchants`/`vendors`; grocery List instance → the F08 `shopping_lists` row of `type='grocery'` for the inbox's property. Multi-intent emails yield multiple actions on one thread.

## 8. Routing → existing features (exact wiring)
Confirming a proposal calls the **existing** feature endpoints under the actor's authz, then writes `agent_action_result_link` (provenance) + `thread_events(action_confirmed)`:
- **delivery** → `Calendar.create` (category `delivery`, `start_on=eta_date`, optional `start_time`); task via `Tasks.create`.
- **receipt/expense** → `Receipts.create` (F13) + line items; `Expenses.create` (F17, status `pending` → approval queue); attachment already an F05 doc; `document_links` thread↔receipt.
- **grocery_order** → the receipt/expense path **plus** append to the property's grocery `shopping_lists` (F08) — a "delivered order" record; the list's place-order/cadence is untouched.
- **invoice** → `Bills`/reconciliation (F14/F15): match to a `bills` schedule, flag ±15% variance, `mode=review`; **never marks paid**.
- **service_booking** → `Calendar.create` + `Maintenance` plan proposal `task_links`/linked to the asset (F04/F19/F11); assign the thread.
- **warranty/statement** → `Documents` (F05) + `asset_insurance`/reminder.
All money-moving stays manual (mark-paid is human-only, F16 invariant).

## 9. API (Tapir; `com.kanzen.api.Inbox`, `MailSync`, `Agent` extended)
Errors `statusCode.and(jsonBody[ApiError])`; bearer security → `Principal`; all reads scope-filtered, writes authz-gated (§2).

**Mailboxes / inboxes**
- `GET  /api/inbox/accounts` → connected mailboxes (Principal).
- `POST /api/inbox/accounts` `{address}` → connect (Admin) · `DELETE /api/inbox/accounts/:id`.
- `GET  /api/inboxes` → `[InboxView{id,address,label,kind,count,unread}]` (scope-filtered; counts never leak).
- `POST /api/inboxes` `{address,label,kind,propertyId?}` → create on the fly · `DELETE /api/inboxes/:id`.

**Threads**
- `GET  /api/inbox/threads?inbox=&status=open|snoozed|done|archived&assignee=me|:id&q=&cursor=` → paginated `ThreadView[]` (Staff → only assigned/in-scope).
- `GET  /api/inbox/threads/:id` → `ThreadDetail{thread, messages[], attachments[], comments[], drafts[], actions[](agent proposals), events[]}`.
- `POST /api/inbox/threads/:id/assign` `{assigneeId|null}` (`thread:assign`).
- `POST /api/inbox/threads/:id/status` `{status, snoozedUntil?}` (`thread:status`; syncs Gmail label).
- `POST /api/inbox/threads/:id/read` `{unread:bool}`.
- `POST /api/inbox/threads/:id/task` `{...CreateTaskReq}` → create a task linked back (`task_links target='email_thread'`); `thread_events(task_created)`.

**Messages / send / drafts**
- `GET  /api/inbox/messages/:id/body` → sanitized HTML for the iframe (server sanitizes too; defence-in-depth) + `loadImages` flag.
- `POST /api/inbox/threads/:id/send` `{toAddrs,ccAddrs,subject,bodyHtml,draftId?}` (`mail:send`, acting user) → Gmail send + outbound message.
- `POST /api/inbox/threads/:id/drafts` `{...}` · `PATCH /drafts/:id` · `DELETE /drafts/:id` (shared drafts).
- `POST /api/inbox/messages/:id/reprocess` (re-run agent; versioned).

**Collaboration**
- `POST /api/inbox/threads/:id/comments` `{body, mentions[]}` (`thread:comment`) → emits F34 notifications to mentions; **never** outbound.

**Agent proposals** (reuse F26): `POST /api/agent/actions/:id/confirm` (optional edited `extracted`) · `/reject` · bulk-confirm (financial excluded).

**Webhook**: `POST /api/inbox/webhook/gmail` (Pub/Sub-authenticated; not bearer) → enqueue history sync.

## 10. UI / screens & states (`input/inbox.jsx` + `triage.jsx`; Front/Superhuman-grade)
**Route** `/inbox` (replaces the current Inbox), three-pane, keyboard-first, StyleX tokens, dark+light, axe-clean.
- **Rail** (`<InboxRail>`): inboxes (`All`, `wardian@`, `deliveries@`, `groceries@`…) + saved views (`Assigned to me`, `Unassigned`, `Snoozed`, `Done`), each a live count pill (TanStack Query, scope-filtered); "+ New inbox" (alias on the fly). Plus the existing F26 streams entry (`Triage`).
- **Thread list** (`<ThreadList>`, `@tanstack/react-virtual`): row = sender · subject · snippet · `<PersonAvatar>` (assignee) · **agent-proposal badge** · attachment icon · unread (bold) · relative time; multi-select; `data-testid="thread-row"`.
- **Thread view** (`<ThreadView>`): message stack — each message body rendered via **DOMPurify → sandboxed `<iframe srcdoc>`** with a "load images" toggle; attachments as F05 doc tiles; the **agent proposal panel inline** (the F26 Triage detail embedded: editable extracted KV + Confirm/Edit/Reject); the **`<ReplyComposer>`** (Lexical) + **shared drafts**; the **`<CommentsPanel>`** (Lexical w/ @mentions); header controls — **assign** (PersonAvatar reassign), status (snooze/done/archive), **convert → task**, "open in Gmail".
- **Keyboard map** (tinykeys, scoped to `/inbox`):

  | Key | Action |  | Key | Action |
  |---|---|---|---|---|
  | `j` / `k` | next / prev thread | | `r` | reply |
  | `Enter` | open thread | | `c` | comment (internal) |
  | `e` | archive | | `t` | → task |
  | `a` | assign | | `s` | snooze |
  | `u` | toggle unread | | `⌘↵` | send / confirm proposal |

- **States**: inbox-zero ("Inbox zero, on the agent's side."), loading (skeleton rows), error, **reauth-needed** (mailbox token lapsed → reconnect banner), sending, send-failed, snoozed-empty.
- **a11y**: list = `role=listbox`/`option` with roving tabindex; the iframe gets a `title`; composer + comments are labelled; keyboard map mirrors visible affordances; contrast via tokens (no `ink4` text on white; mirror prior fixes).

## 11. Collaboration (Front-grade)
- **Assignment**: `<PersonAvatar>` (built) on each thread; assign/reassign via the hover card → `thread:assign`; emits F34 notification to the new assignee; Staff scope keys off the assignee.
- **Internal comments + @mentions**: `<CommentsPanel>` (Lexical mention node); `@person` resolves against the people list; on post → F34 notification to mentioned users; **rendered only in Kanzen, never serialized into any outbound email** (tested, V2-AC7).
- **Shared drafts**: `email_drafts(shared=true)` visible to collaborators on the thread; last-writer-wins with an `updated_at` guard; on send becomes the outbound message.
- **Read/seen**: `unread` per thread synced to Gmail `UNREAD`; "seen by" derived from `thread_events`.
- **Activity timeline**: `thread_events` rendered via the reusable `<Timeline>`/`<ActivityFeed>` (W2/W8.5).

## 12. Business rules & invariants
- **Never moves money; financial/asset proposals never auto-commit** (F27 server-enforced regardless of trust). Confirm runs under the **acting user's** authz.
- **Source email immutable in S3** (sacred); OCR/extraction derived/versioned; reprocess = new version.
- **Permission/scope-filtered everywhere** — Staff see only assigned/in-scope threads; counts never leak (no leak via totals → 403/404).
- **Idempotent** by Gmail ids; duplicate pushes are no-ops.
- **Every created record links back to its source message** (`agent_action_result_link`); agent ribbon shows where it acted.
- **Sending is human** (`mail:send`, acting identity); the **agent never sends**.
- Attachments **malware-scanned** before filing; unsafe → `email_attachments.safe=false`, no downstream actions, audited.
- All meaningful actions audited (`thread_events` + `audit_log_entries`).

## 13. Edge cases
Multi-intent email; long threads / large backfill; non-English; spam/phishing (scan + low trust + a Spam inbox + `List-Unsubscribe` surfaced); attachment-less receipts; mailbox auth lapse (reauth banner + `status='reauth'`); Gmail rate limits / Pub/Sub redelivery; concurrent reviewers (thread claim/lock via advisory lock or optimistic `version`); bulk archive with mixed financial proposals (financial excluded); proposal whose target was deleted (fail gracefully, audit); send failure / bounce (surface, retain draft); Gmail-side reply while Kanzen open (history reconciles); catch-all flood (rate-limit + auto-archive obvious bulk/marketing); remote-image tracking pixels (blocked by default).

## 14. Acceptance scenarios (UAT)
Existing **F25 AC1–AC8** + **F26 AC1–AC8** carry forward (ingest idempotency, financial lock, reject-learning, atomic confirm, actor authz, scope, inbox-zero). **New for v2** (each automated, §15):
- **V2-AC1 — Real thread syncs in & renders** ‹`GmailSyncIT` (mocked), web `inbox.spec`›: a message at `wardian@` → thread+message appear, raw in S3, attachments as F05 docs; archive in Kanzen removes Gmail `INBOX`.
- **V2-AC2 — Grocery order → list-linked expense trail** ‹`GroceryRoutingIT`›: an Ocado confirmation → proposed receipt + expense **linked to the grocery List instance**; nothing committed until confirmed.
- **V2-AC3 — Car-service booking → the vehicle** ‹`ServiceRoutingIT`›: a service email → proposed calendar event + maintenance proposal **linked to the Range Rover asset**, assignable.
- **V2-AC4 — Assign a thread; Staff see only theirs** ‹`ThreadScopeIT`, web `inbox.spec` scope›: assigning to Marcia → visible to her, absent for other Staff; no financial proposals to Staff.
- **V2-AC5 — Thread → task; done makes it go away** ‹`ThreadToTaskIT`›: thread→task (linked back); marking done removes it from the open queue + syncs the Gmail label.
- **V2-AC6 — Reply/send threaded** ‹`SendReplyIT` (send mocked)›: a reply posts in-thread via Gmail; stored outbound with `sent_by`; the agent cannot send.
- **V2-AC7 — Internal comment + @mention notifies, never leaves Kanzen** ‹`ThreadCommentIT`›: an @mention notifies (F34); **never** in any outbound email.
- **V2-AC8 — Shared draft** ‹`SharedDraftIT`›: a draft visible to collaborators, editable, on send becomes the outbound message.
- **V2-AC9 — Idempotent sync** ‹`SyncIdempotencyIT`›: redelivered Pub/Sub history → one thread/message, no dup actions.
- **V2-AC10 — Reauth surfaces** ‹`ReauthIT`›: a 401 from Gmail → `account.status='reauth'` + a reconnect banner; sync pauses, no data loss.

## 15. Test plan (named)
**Backend (weaver + Testcontainers-PG; Gmail + Pub/Sub + Bedrock mocked):** `GmailSyncIT` (history upsert + idempotency + cursor), `SyncIdempotencyIT`, `ReauthIT`, `AgentClassifyIT` (per-intent extraction; deterministic stub), `GroceryRoutingIT`, `ServiceRoutingIT`, `ReceiptRoutingIT`, `TrustRouteIT` (financial always propose), `ThreadScopeIT` (Staff assignee-scope; no leak), `ThreadToTaskIT`, `SendReplyIT` (threading + acting identity; agent-can't-send negative), `ThreadCommentIT` (mention notify + outbound-isolation), `SharedDraftIT`, `AttachmentScanIT`, `ProvenanceLinkIT`, `ConfirmAuthzIT` (carry F26 AC7). Pure: `AgentClassifierSpec` (rules), `LabelSyncSpec` (status↔label map).
**Web (Vitest):** `InboxRail`, `ThreadList` (virtualized), `ThreadView` (iframe sanitize), `ReplyComposer` (Lexical), `CommentsPanel` (@mention), keyboard map. **Playwright:** sync-render, assign, convert-to-task, reply, comment, snooze/done, reauth banner; **axe** every state. **Mobile (F31):** capture + assigned-to-me triage.

## 16. Observability & audit
Audit every ingest/classify/propose/confirm/assign/comment/send/status. Metrics: mail/day by inbox+intent, auto-exec vs propose ratio, classification confidence histogram, proposal acceptance rate, time-to-triage, queue depth by inbox/assignee, send volume, sync lag (Pub/Sub→stored), watch-renewal + reauth + error rates, attachment-scan blocks.

## 17. Operator inputs (→ `SETUP.md`; gates Done-prod)
1. **Domain**: own `kanzen.family`; **MX** → Google; **catch-all** routing to `wardian@` (or a catch-all mailbox). Optional aliases for `deliveries@`/`groceries@`/`vendors@`.
2. **Google Workspace**: tenant; the seed mailbox `wardian@`; a **service account** with **domain-wide delegation** authorising scopes `gmail.readonly`, `gmail.modify`, `gmail.send`; (fallback: per-mailbox OAuth client + consent).
3. **Pub/Sub**: a topic + push subscription to `https://<host>/api/inbox/webhook/gmail`; grant Gmail publish rights on the topic.
4. **Bedrock**: region (eu-west-1) + Claude model id for classify/extract; IAM for the backend.
5. **S3**: bucket for raw email + attachments (reuse F05 `ObjectStore`); a malware-scan hook (e.g. lambda/clamav) on attachment put.
6. **Config/secrets**: service-account key in Secrets Manager; topic/sub names, model id, thresholds `τ_auto`/`τ_review` in SSM.

## 18. Build plan (Wave W9 — each slice ships behind the integration seam, sandbox-testable first)
- **W9.1 — Data model + sync core.** Migration (§4); `MailSync` with an `EmailSource` seam (**sandbox impl = ingest seeded `.eml` fixtures + a `POST /api/inbox/dev/ingest` paste/forward endpoint**; prod impl = Gmail watch→Pub/Sub→history). Raw→S3, attachments→F05, idempotency, threads/messages upsert, label-sync map (no-op in sandbox). Tests: `GmailSyncIT`, `SyncIdempotencyIT`.
- **W9.2 — Agent ingest.** `AgentClassifier` seam (sandbox deterministic stub; prod Bedrock) → per-intent schemas (§7) → `agent_actions` → F27 trust; routing wiring (§8) to F13/F17/F08/F07/F11/F04. Tests: `AgentClassifyIT`, `GroceryRoutingIT`, `ServiceRoutingIT`, `TrustRouteIT`.
- **W9.3 — Collaborative inbox UI.** Three-pane rail/list/thread (§10); DOMPurify+iframe; virtualized list; assignment (PersonAvatar); inline agent proposals (embed F26 Triage); convert→task; status/snooze/done + label sync; keyboard (tinykeys). Vitest + Playwright + axe.
- **W9.4 — Send + collaboration.** Reply composer + shared drafts (Lexical); internal comments + @mentions + F34 notifications; read/seen. Tests: `SendReplyIT`, `ThreadCommentIT`, `SharedDraftIT`.
- **W9.5 — Hardening + live.** Wire the prod `EmailSource`/`AgentClassifier` (Gmail+Bedrock) once §17 lands; reauth/watch-renewal job; phishing/spam + catch-all flood controls; learned categorisation (F27); multi-account. Operator-gated.
- **Seed fixtures** (sandbox realism): a handful of real-shaped `.eml` — an Ocado order, a UPS dispatch, a garage service confirmation (Range Rover), a utility invoice, a personal email — so the pipeline + UI demo end-to-end without Gmail.

## 19. Open questions
1. Send-as identities & signatures per shared inbox (who may send as `wardian@`?). 2. How much Gmail label structure to mirror vs keep Kanzen-side. 3. Snooze/SLA automation depth. 4. Catch-all abuse/flood controls. 5. Connecting personal / multi-domain accounts beyond `kanzen.family`. 6. External-participant visibility to Staff (thread completeness vs scope). 7. Learned categorisation feedback loop shape (F27). 8. Retention/erasure policy for raw emails (GDPR) vs the "immutable source" rule.
