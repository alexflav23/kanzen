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

## 9. Acceptance criteria
- **AC1** A delivery email auto-creates (if trusted) or proposes a task + calendar event, linked to the source email, with the agent ribbon.
- **AC2** A receipt email files the original to S3, runs OCR (F13), and proposes line items + an asset — **never auto-committed**.
- **AC3** An invoice reconciles against the bill schedule and flags a ±15% variance in the Inbox.
- **AC4** Rejecting a proposal dismisses it and feeds sender learning; nothing is silently executed for financial categories.
- **AC5** All classification/extraction runs on Bedrock in eu-west-1; attachments are malware-scanned.
- **AC6** Processing is idempotent per `message_id`.

## 10. Test plan
Backend (weaver+PG; Gmail + Bedrock mocked): ingest idempotency; per-category extraction schema; action mapping; trust routing (financial always propose); attachment→document+scan; provenance back-links; reprocess versioning. Integration with F13/F15.

## 11. Observability & audit
Audit: every ingest, classification, action proposed/executed/rejected, document filed. Metrics: emails/day by mailbox+category, auto-exec vs propose ratio, classification confidence, action acceptance rate, processing lag, errors.

## 12. Open questions
1. Poll interval per mailbox (latency vs Gmail quota). 2. Per-category extraction schemas (detail). 3. Phishing/spam handling depth. 4. Which categories (if any) start trusted (recommendation: all review, financial locked).
