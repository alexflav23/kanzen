-- W9.4 / F44 — outbound Gmail send queue. The inbox "send" records the message (the artifact) AND enqueues a durable
-- dispatch; a worker drains it through the GmailSender seam (StubGmailSender honours the F44 "Workspace connected"
-- contract; the real Gmail API client drops in behind the trait once the operator connects Workspace). Idempotent on
-- message_id so a re-enqueue coalesces; the message is never sent twice.
create table gmail_send_queue (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  thread_id   uuid not null,
  message_id  uuid not null,
  status      text not null default 'pending',  -- pending | sent | failed
  provider_message_id text,                      -- the Gmail message id once dispatched
  attempts    int  not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  unique (message_id)
);
create index gmail_send_queue_pending_idx on gmail_send_queue (created_at) where status = 'pending';
