# Feature F25/F26 v2 — Collaborative Inbox (the flow-of-life surface)

| | |
|---|---|
| **Feature ID** | F25/F26 v2 (supersedes the F25 *email agent* + F26 *unified inbox/triage* sandbox slices; F27 trust unchanged) |
| **Wave** | **W9 — Collaborative Inbox** (new; the keystone after the W1–W8 core) |
| **Domain** | Agent + Operations (the inbox *is* the operating surface) |
| **Status** | ✍️ spec — **build deferred until infra is provisioned** (real Google Workspace + Bedrock + `kanzen.family` DNS); operator-gated |
| **Depends on** | F02 (agent principal + authz/scope), F05 (docs/S3), F06 (tasks), F07 (calendar), F08 (lists), F11 (maintenance), F13 (receipts/OCR), F14/F15 (reconcile/bills), F17 (expenses), F04/F19 (assets), F10 (people/assignment + PersonAvatar), F27 (trust), F34 (events) |
| **Spec references** | SPEC §3.6, §7.2, §10.1–10.2; `input/views/inbox.jsx`, `triage.jsx`; the existing `F25-email-agent.md` + `F26-inbox-triage.md` (the engine this builds on) |

> **The vision (owner's words):** *"The biggest feature — the inbox drives the flow of life. Forward emails to inboxes created on the fly; Google runs the email so we don't reinvent it; a client + UI wrapper on top; an AI ingest agent that discerns (a UPS delivery, an expense → a receipt, an Ocado order → an expense/receipt trail on the grocery list, a car-service booking → the car); each thread assignable to a person; each thread turn-into-a-task; a collaborative inbox where a completed task can go away; and all household accounts on `wardian@kanzen.family` so Amazon/groceries/etc. are automatic."*

---

## 0. Decisions (locked — from the scoping round)

1. **Real email, Front/Superhuman-grade — not virtual labels.** Kanzen is a *full client* over **real Google Workspace mailboxes** (Gmail API). `wardian@kanzen.family` is a real, sendable mailbox you sign up to Amazon/Ocado with; `deliveries@`, `groceries@`, `vendors@`… are real domain addresses (aliases / a **catch-all**) delivering into the connected mailbox(es). "Created on the fly" = add an alias / rely on catch-all — every address is real RFC822 mail, synced bidirectionally. **We do not reinvent email; Google is the mail server, Kanzen is the client.**
2. **Read *and* send/reply from Kanzen** (Gmail send scope; threaded replies; signatures; **shared drafts**). A proper mail client, not read-only triage.
3. **Front-grade collaboration**: assign a thread to a person; **internal comments + @mentions**; **shared draft** replies; read/seen indicators; statuses (open · assigned · snoozed · done · archived); convert a thread → a **task** (F06); done/archive makes it "go away".
4. **AI ingest agent** (the F25 engine, elevated): every inbound message → classify + extract → **typed proposals** (F27 trust — financial/asset **never auto-commit**), surfaced inline in the thread and in the Triage stream.
5. **Spec now, build later.** This is operator-gated (Workspace domain-wide delegation, Pub/Sub, Bedrock, `kanzen.family` MX/catch-all). Build is sequenced as **Wave W9** once `SETUP.md` inputs land. (A sandbox spine — model + sample-email ingest + deterministic classifier + the collaborative UI — can be built ahead of live Gmail behind the integration seam, but is **explicitly deferred** by this decision.)
6. **Hand-roll the UI** (house style, `input/inbox.jsx`/`triage.jsx` language). Open-source only for plumbing (email MIME parsing, HTML sanitisation) — **not** a third-party webmail shell.

---

## 1. Purpose & user value
Turn the household's email into the single collaborative surface the estate runs from: real mail flows into Kanzen, the agent reads it and proposes the right Kanzen action (receipt, expense, delivery event, list order, car-service on the vehicle), a human confirms, and the thread can be assigned, discussed, turned into a task, and archived when done. **AI proposes; the Principal/Manager decides; Staff get only their threads.** It is Front/Superhuman for a family office, wired into the registry, finance and operations.

## 2. Roles & permissions (F02)
- **Agent** = system principal (seeded Agent role): ingest, classify, propose; **cannot auto-commit financial/asset** (F27, hard lock); same authz + audit path as humans.
- **Principal**: all inboxes, all threads, all streams, trust settings, connect mailboxes.
- **Manager**: shared inboxes in scope; confirm non-financial; financial → review; assign; comment; send (from shared identities they're granted).
- **Staff**: **only threads assigned to them** (or in their property's shared inbox per scope) — mirrors the Tasks/Lists `AssigneeScope` model; never sees other inboxes or financial proposals.
- New gated actions (catalogue, F02 v2): `inbox:view`, `thread:assign`, `thread:comment`, `mail:send`, `mailbox:connect` (admin), `thread:status` (archive/snooze/done). Sending runs as the **acting user** from a granted send-identity; the agent never sends.

## 3. Data model (`V__collaborative_inbox.sql`)
Builds on F25's `incoming_emails`/`agent_actions` (the engine) by adding the **thread/message/collaboration** layer; `email_messages` supersedes `incoming_emails` (migrate: an incoming email *is* an inbound message) and `agent_actions.message_id → email_messages`.

- **`mail_accounts`** — a connected Workspace identity: `id, address, display_name, gmail_history_id (sync cursor), watch_expires_at, scopes, status (connected|reauth|error), created_at`.
- **`mail_inboxes`** — the addresses surfaced as inboxes (on the fly): `id, account_id, address, label, kind (shared|personal|catch_all), property_id null, owner_id, created_at`. (`groceries@`, `wardian@` …; catch-all delivers unknown locals here.)
- **`email_threads`** — `id, gmail_thread_id unique, inbox_id, subject, snippet, participants jsonb, last_message_at, message_count, unread bool, has_attachments bool, status (open|snoozed|done|archived), snoozed_until, assignee_id (employment_records.id) null, owner_id, created_at`.
- **`email_messages`** — `id, gmail_message_id unique, thread_id, direction (inbound|outbound), from_addr, to_addrs jsonb, cc_addrs jsonb, subject, sent_at, headers jsonb, body_text, body_html_s3_key, raw_s3_key (immutable original — *sacred*), is_draft bool, sent_by uuid null, created_at`.
- **`email_attachments`** — `id, message_id, document_id → documents (F05), filename, content_type, size_bytes, scanned bool`.
- **`thread_comments`** — internal collaboration: `id, thread_id, author_id, body, mentions uuid[], created_at` (never sent to anyone outside — Front-style internal notes).
- **`email_drafts`** — shared draft replies: `id, thread_id, author_id, to/cc/subject/body, shared bool, status (draft|sent|discarded), updated_at`.
- **`thread_events`** — the thread's activity/audit timeline: `id, thread_id, actor_id (or 'agent'), kind (received|assigned|status|comment|agent_proposed|action_confirmed|sent|task_created), payload jsonb, at`.
- Reuses: **`agent_actions`** (F25; now `message_id`-keyed), `agent_action_result_link` (provenance), `sender_rules` (F27), `documents`/`document_links` (F05), `tasks`/`task_links` (F06; a thread→task link), `merchants` (F12).

## 4. Sync architecture (Gmail as the server)
- **Connect**: a Workspace **service account with domain-wide delegation** (read/modify/send scopes) → access to every mailbox on `kanzen.family` with one credential; per-mailbox OAuth is the fallback for non-Workspace.
- **Inbound (real-time)**: `users.watch` per mailbox → **Pub/Sub** push to a Kanzen webhook → incremental `history.list` from `gmail_history_id` → upsert threads/messages (idempotent by `gmail_message_id`); full backfill on first connect. Watch renews before expiry; poll fallback.
- **Raw + attachments**: store the **immutable raw RFC822** in S3 (`raw_s3_key`) and each attachment as an F05 document (malware-scanned) — the source is sacred (never mutated; OCR is derived).
- **Outbound (send/reply)**: `users.messages.send` threaded via `In-Reply-To`/`References`; the sent message is stored as an outbound `email_message` (`sent_by` = the acting user). Shared drafts are Kanzen-side until sent.
- **Bidirectional state**: archive/done/read in Kanzen ↔ Gmail labels (`INBOX`/`UNREAD` removal, a `Kanzen/Done` label), so the two stay consistent (Front-style). **Assignment, comments, drafts are Kanzen-only metadata** (not pushed to Gmail), exactly like Front.

## 5. The AI ingest agent (classify → extract → propose)
Per inbound message (deterministic rules first, then **Bedrock/Claude** structured-output behind the seam — sandbox uses a deterministic stub like NL/F32):
- **Classify** into an intent (below) with a confidence.
- **Extract** a per-intent structured schema (merchant, amount+currency, dates, tracking no., line items, vehicle reg, list name…).
- **Map → typed `agent_actions`** → **F27 trust route**: non-financial trusted → may auto-execute (audited, agent ribbon); **financial/asset → always propose**; low confidence → propose.

**Intent taxonomy → proposed action → target feature** (every one *proposed*, never silently committing money/assets):

| Intent | Example | Proposed action(s) | Target |
|---|---|---|---|
| **delivery** | UPS/Amazon dispatch | `create_event` (delivery window) [+ `create_task` "be in"] | F07 / F06 |
| **receipt / expense** | a shop receipt | `create_receipt` + parse line items (OCR) + `propose_expense` + file source | F13 / F17 / F05 |
| **grocery order** | Ocado confirmation | receipt + **expense trail linked to the grocery List instance** (append an order to that F08 list) | F08 / F13 / F17 |
| **invoice / bill** | utility invoice | `reconcile_bill` (±15% variance) or `propose_bill` | F15 / F14 |
| **service / booking** | car-service appointment | `create_event` + propose maintenance/plan **linked to the vehicle asset**; assign | F07 / F11 / F04·F19 |
| **warranty / document** | warranty PDF, statement | `file_document` + attach to asset + `set_reminder` | F05 / F04 / F11 |
| **travel** | flight/hotel confirmation | `create_event` | F07 |
| **generic** | a person emailing | none — a thread for a human (assign / comment / task) | — |

Multi-intent emails yield multiple proposed actions on the one thread. Rejections feed sender learning (F27).

## 6. UI / screens & states (`input/inbox.jsx` + `triage.jsx`, Front/Superhuman-grade)
- **Three-pane, keyboard-first**:
  - **Rail** (left): inboxes (`All`, `wardian@`, `deliveries@`, `groceries@`…), plus saved views (`Assigned to me`, `Unassigned`, `Snoozed`, `Done`), each with live counts. "+ New inbox" (alias, on the fly).
  - **Thread list** (middle): sender · subject · snippet · **assignee avatar** (PersonAvatar) · **agent-proposal badge** · attachment/▾ · unread (bold) · time; bulk select.
  - **Thread view** (right): the message stack (sanitised HTML, attachments as F05 docs); the **agent's proposed actions inline** (editable extracted KV + Confirm/Edit/Reject — the F26 Triage detail, embedded); the **reply composer + shared drafts**; an **internal comments panel** (@mentions); header controls — **assign**, status (snooze/done/archive), **convert → task**, "open in Gmail".
- **Triage stream** stays as a cross-inbox view of all open agent proposals (the existing F26 streams: Agent · Reconciliation · Data quality · Reminders).
- **Keyboard** (Superhuman): `j/k` navigate · `e` archive · `a` assign · `c` comment · `r` reply · `t` → task · `⌘↵` send/confirm · `s` snooze.
- **Assignment** = PersonAvatar + reassign (built). **Convert→task** prefills from the thread and links the task back (`task_links`/thread link). **Done/archive** removes it from the open queue ("goes away") and syncs the Gmail label.
- States: inbox-zero ("Inbox zero, on the agent's side."), loading, error, reauth-needed (mailbox token lapsed), sending, send-failed.

## 7. Business rules & invariants
- **Never moves money; financial/asset proposals never auto-commit** (F27 — enforced server-side regardless of trust). Confirm runs under the **acting user's** authz.
- **Source email immutable in S3** (sacred); OCR/extraction is derived/versioned; reprocess is a new version.
- **Permission/scope-filtered everywhere** — Staff see only assigned threads; counts never leak other inboxes (no leak via totals).
- **Idempotent** by `gmail_message_id`/`gmail_thread_id`; duplicate pushes are no-ops.
- **Every created record links back to its source message** (`agent_action_result_link`); the agent ribbon shows wherever it acted.
- **Sending** is a human action (`mail:send`, acting identity); the **agent never sends email**.
- Attachments **malware-scanned** before filing; unsafe → `error`, audited, no downstream actions.
- All meaningful actions audited (ingest, classify, propose, confirm, assign, comment, send, status) via `thread_events` + the platform audit log.

## 8. Edge cases
Multi-intent email; long threads/backfill volume; non-English; spam/phishing (scan + low trust + a Spam inbox); attachment-less receipts; mailbox auth lapse (reauth banner); Gmail rate limits / Pub/Sub redelivery; concurrent reviewers (thread claim/lock); bulk archive with mixed financial proposals (financial excluded); a proposed action whose target was deleted; send failure / bounce; reply to a thread Gmail-side while Kanzen is open (history sync reconciles); catch-all flooding (rate-limit + auto-archive obvious bulk).

## 9. Acceptance scenarios (UAT) — extends F25/F26 ACs
(Existing F25 AC1–AC8 + F26 AC1–AC8 carry forward — ingest idempotency, financial lock, reject-learning, atomic confirm, actor authz, scope, inbox-zero.) **New for v2:**

- **V2-AC1 — Real thread syncs in and renders** ‹`GmailSyncIT` (mocked), web `inbox.spec`›: a message at `wardian@` → a thread+message appear with raw in S3, attachments as F05 docs; archive in Kanzen removes Gmail `INBOX`.
- **V2-AC2 — Grocery order → list-linked expense trail** ‹`GroceryRoutingIT`›: an Ocado confirmation → a proposed receipt + expense **linked to the grocery List instance**; nothing committed until confirmed.
- **V2-AC3 — Car-service booking → the vehicle** ‹`ServiceRoutingIT`›: a service-appointment email → a proposed calendar event + maintenance proposal **linked to the Range Rover asset**, assignable.
- **V2-AC4 — Assign a thread; Staff see only theirs** ‹`ThreadScopeIT`, web `inbox.spec` scope›: assigning a thread to Marcia makes it visible to her and absent for other Staff; financial proposals never shown to Staff.
- **V2-AC5 — Convert thread → task; done makes it go away** ‹`ThreadToTaskIT`›: a thread → a task (linked back); marking the thread done removes it from the open queue and syncs the Gmail label.
- **V2-AC6 — Reply/send from Kanzen, threaded** ‹`SendReplyIT` (Gmail send mocked)›: composing + sending a reply posts via Gmail in-thread; the sent message is stored outbound with `sent_by`; the agent cannot send.
- **V2-AC7 — Internal comment + @mention notifies, never leaves Kanzen** ‹`ThreadCommentIT`›: an internal comment with an @mention notifies that person (F34) and is **never** included in any outbound email.
- **V2-AC8 — Shared draft** ‹`SharedDraftIT`›: a draft reply is visible to collaborators, editable, and on send becomes the outbound message.

## 10. Test plan
Backend (weaver+PG; **Gmail + Pub/Sub + Bedrock mocked**): sync upsert/idempotency + history cursor; per-intent extraction schema; routing (grocery→list, service→vehicle, receipt→F13); trust routing (financial always propose); thread assignment + Staff scope; comment/@mention isolation (never outbound); shared-draft→send; send threading + acting-identity; attachment→document+scan; provenance back-links; archive↔label sync. Web: Vitest (rail/list/thread/composer/comments/keyboard) + Playwright (sync-render, assign, convert-to-task, reply, comment, done) + a11y. Mobile (F31): capture + assigned-to-me triage.

## 11. Observability & audit
Audit every ingest/classify/propose/confirm/assign/comment/send/status. Metrics: mail/day by inbox+intent, auto-exec vs propose ratio, classification confidence, proposal acceptance, time-to-triage, queue depth by inbox/assignee, send volume, sync lag, reauth/error rates.

## 12. Operator inputs (→ `SETUP.md`; gates Done-prod)
- `kanzen.family` domain + **MX + catch-all** routing into the connected mailbox(es).
- Google **Workspace** + a **service account with domain-wide delegation** (gmail.readonly, gmail.modify, gmail.send) — or per-mailbox OAuth; the seed mailbox `wardian@`.
- **Pub/Sub** topic + push subscription for `users.watch`.
- **Bedrock** (Claude) region + model for classify/extract.
- **S3** bucket for raw email + attachments (F05); malware-scan hook.

## 13. Build plan (Wave W9, when infra lands)
1. **W9.1 Data model + sync** — tables; Gmail connect + watch→Pub/Sub + history sync + backfill; raw→S3; attachments→F05; idempotency. (Sandbox: ingest seeded sample `.eml` + a manual "forward/paste" endpoint behind the same interface.)
2. **W9.2 Agent ingest** — deterministic rules + Bedrock classify/extract (stub in sandbox) → `agent_actions` → F27 trust; the intent taxonomy (§5) wired to F13/F17/F08/F07/F11/F04.
3. **W9.3 Collaborative inbox UI** — three-pane rail/list/thread; assignment (PersonAvatar); inline agent proposals (embed F26 Triage detail); convert→task; status/snooze/done + label sync; keyboard.
4. **W9.4 Send + collaboration** — reply composer, shared drafts, internal comments + @mentions + notifications (F34), read/seen.
5. **W9.5 Hardening** — phishing/spam, rate limits, reauth, multi-account, learned categorisation (F27).

## 14. Open questions
1. Send-as identities & signatures per shared inbox (who can send as `wardian@`?). 2. How much Gmail label structure to mirror vs keep Kanzen-side. 3. Snooze/SLA automation depth. 4. Catch-all abuse/flood controls. 5. Multi-domain / personal-account connection (beyond `kanzen.family`). 6. Reply-all / external participants visibility to Staff (scope vs thread completeness).
