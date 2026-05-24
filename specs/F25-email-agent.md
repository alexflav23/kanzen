# Feature F25 — Email agent pipeline

| | |
|---|---|
| **Feature ID** | F25 |
| **Milestone** | M6 |
| **Domain** | Agent |
| **Status** | ✅ spec complete |
| **Depends on** | F05 (docs/S3), F13 (receipts/OCR), F15 (bills), F06 (tasks), F07 (calendar), F02 (agent principal), F27 (trust/rules) |
| **Spec references** | SPEC §10.1–10.2; `input/views/triage.jsx`, App. E.3 |

> **Decisions (made):** the agent watches **five Gmail role inboxes** (`deliveries@/accounts@/house@/vendors@/concierge@`); pipeline = ingest → **deterministic rules** → **Claude on Bedrock** classify+extract (structured output) → map to **AgentActions** → **trust check** → auto-execute (trusted, low-risk) or **propose in the Inbox/Triage**; the agent **files documents to S3** (never Drive); **financial records & asset creation never auto-commit**; every created record links back to its source email; runs as a **system principal** through the same authz/audit path.

## 1. Purpose & user value
Inbound household mail becomes proposed (or, where trusted, executed) actions — a delivery becomes a task + calendar event, a receipt becomes parsed line items + an asset proposal, an invoice reconciles against the bill schedule and flags variance — with a human in the loop and full auditability. The labour-saver that keeps the household running from the inbox.

## 2. Roles & permissions
The agent is a **system principal** bound to a seeded **Agent role** (F02) — it can only do what that role permits, takes the same audit path as humans, and **cannot auto-execute financial/asset categories** (locked, F27). Proposals are reviewed by Principal/Manager (scoped).

## 3. Data model
`V__agent.sql`:
- **`incoming_emails`** — `id, owner_id, mailbox text, message_id text unique, from_addr, subject, received_at, raw_s3_key text, body_excerpt text, category text, confidence numeric, status ('pending'|'proposed'|'auto_executed'|'dismissed'|'error'), created_at`.
- **`agent_actions`** — `id, email_id → incoming_emails, type text (create_task|create_event|file_document|create_receipt|reconcile_bill|propose_bill|propose_asset|set_reminder|link_plan|notify), payload jsonb, extracted jsonb, confidence numeric, status ('proposed'|'confirmed'|'rejected'|'executed'|'failed'), target_type, target_id uuid null, created_at, executed_at null`.
- **`agent_action_result_link`** — `(action_id, result_type, result_id)` — back-link created records to the source email.
- Reuses `sender_rules`/`rules` (F27), `merchants` (F12).

## 4. API
Internal pipeline (EventBridge-driven): `pollMailbox`, `ingest`, `classifyExtract` (Bedrock), `mapActions`, `trustRoute` (F27), `execute|propose`. User-facing: `GET /api/agent/history`, `POST /api/agent/emails/:id/reprocess` (re-run classify/extract — versioned). Confirm/reject lives in the Inbox (F26).

## 5. UI / screens & states
Feeds **Inbox → Agent proposals / Triage** (F26, App. E.3): per-item email excerpt → **agent-extracted fields (editable)** → **proposed actions** (typed icons) → Confirm/Edit/Reject. **Agent activity** on the dashboard + the agent ribbon wherever it acted. History + audit. States: pending, proposed, auto-executed, dismissed, error.

## 6. Business rules & validation
- **Ingestion**: poll Gmail per mailbox on a short interval; store raw email (S3) + `IncomingEmail`; idempotent by `message_id`.
- **Classify+extract**: Bedrock Claude with a **per-category structured-output schema** (§10.2); content stays in eu-west-1.
- **Action mapping** per category (§10.2): delivery→task+event; receipt→file doc + parse (F13) + propose asset + reconcile; invoice→file doc + reconcile bill (variance) or propose bill; booking/service→event(+task)(+vendor/asset/plan); warranty→doc+asset attach+reminder; statement→file+reminder; other→human.
- **Trust routing** (F27): trusted low-risk categories auto-execute (audited + notify); **financial/asset categories always propose**; low confidence → propose.
- **Attachments** → documents (F05) with a **malware scan**; files to S3.
- **Provenance**: every executed/created record links to its source email; rejections feed sender learning.

## 7. Integrations / external systems
- **Gmail API** — service account + domain-wide delegation, the **5 mailboxes** (SETUP B3); read-only scope.
- **Bedrock** — Claude classify/extract (SETUP B4). **S3** — raw email + attachments (F05).
- Downstream: F13/F15/F06/F07/F11 adapters. **F27** for trust + rules.

## 8. Edge cases
Ambiguous/multi-intent email (multiple actions); duplicate emails/threads; non-English; spam/phishing (scan + low-trust); attachment-less receipts; mailbox auth lapse (re-auth prompt); Gmail rate limits; partial extraction (low confidence → human); reprocess after a model upgrade; agent action whose target was deleted.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Delivery email auto-executes (trusted) and shows the agent ribbon**  ‹maps: `DeliveryEmailPipelineIT`, web `triage.spec` ribbon›
- **Given** a delivery email arrives at `deliveries@` and the delivery category is set to `auto` (trusted, F27)
- **When** The Agent processes it
- **Then** a task + calendar event are created, both linked to the source email via `agent_action_result_link`
- **And** the agent ribbon appears on the created records in the UI, and the action is audited with `status = auto_executed`.

**AC2 — Receipt files to S3 and proposes — never auto-commits — asset + line items**  ‹maps: `ReceiptPipelineIT`, web `triage.spec` proposed-asset›  *(invariant: financial/asset creation never auto-commits; agent files to S3, never Drive)*
- **Given** a receipt email with a PDF attachment arrives at `accounts@`
- **When** The Agent ingests it
- **Then** the raw email and attachment are stored in S3 (not Drive); OCR runs (F13); extracted line items + an asset creation are **proposed** in the Inbox with `status = proposed`
- **And** nothing is written to the asset registry until a human confirms in Triage; the source document in S3 is immutable.

**AC3 — Invoice flags variance against the bill schedule**  ‹maps: `InvoiceVarianceIT`, web `triage.spec` variance-pill›
- **Given** a recurring bill of £100/month and an invoice email arriving for £118
- **When** The Agent reconciles the invoice against the bill schedule (F15)
- **Then** the action is placed in the Inbox with a variance flag (±15%) and `mode = review`
- **And** the bill is not marked paid; no money is moved.

**AC4 — Financial and asset proposals are never auto-executed regardless of trust settings**  ‹maps: `FinancialLockIT`, web `triage.spec` financial-lock›  *(invariant: financial/asset creation never auto-commits)*
- **Given** a `propose_asset` action resulting from a receipt email, even if trust is misconfigured
- **When** The Agent's trust router evaluates it
- **Then** the action is routed to `proposed` regardless of any trust setting — the lock is enforced server-side (F27)
- **And** no asset row is created; `agent_actions.status = proposed`.

**AC5 — Rejection dismisses and feeds sender learning**  ‹maps: `RejectLearningIT`, web `triage.spec` reject›
- **Given** a proposed action in the Inbox
- **When** Toby rejects it
- **Then** `agent_actions.status = rejected`; a sender-learning signal is recorded (F27); the Inbox item disappears from the queue
- **And** the source email and original S3 artefact remain immutable.

**AC6 — Idempotency: duplicate email is not re-processed**  ‹maps: `IngestIdempotencyIT`›
- **Given** the same email (identical `message_id`) arrives at the same mailbox twice
- **When** the ingest pipeline runs
- **Then** only one `incoming_emails` row exists and the second delivery is silently skipped
- **And** no duplicate actions or documents are created.

**AC7 — Attachment malware scan blocks unsafe files**  ‹maps: `MalwareScanIT`›
- **Given** a malicious attachment is detected by the scan step
- **When** the pipeline processes the email
- **Then** the attachment is not filed to S3; `incoming_emails.status = error`; an alert is audited
- **And** no downstream actions are proposed or executed.

**AC8 — Agent scope: no financial actions outside authz path (negative)**  ‹maps: `AgentAuthzIT`›
- **Given** The Agent's system principal has no `admin` permission
- **When** an action mapping attempts to directly create a financial record (e.g. bill) without going through the Authorizer
- **Then** the Authorizer denies it (403); nothing is committed; the action is flagged `failed` with an audit entry
- **And** Toby sees the failure in the Inbox history.

## 10. Test plan
Backend (weaver+PG; Gmail + Bedrock mocked): ingest idempotency; per-category extraction schema; action mapping; trust routing (financial always propose); attachment→document+scan; provenance back-links; reprocess versioning. Integration with F13/F15.

## 11. Observability & audit
Audit: every ingest, classification, action proposed/executed/rejected, document filed. Metrics: emails/day by mailbox+category, auto-exec vs propose ratio, classification confidence, action acceptance rate, processing lag, errors.

## 12. Open questions
1. Poll interval per mailbox (latency vs Gmail quota). 2. Per-category extraction schemas (detail). 3. Phishing/spam handling depth. 4. Which categories (if any) start trusted (recommendation: all review, financial locked).
