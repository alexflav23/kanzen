-- F07 Path B — outbound Google Calendar sync substrate (push Kanzen events → Google), riding the F44 WorkspaceAuth seam.
-- The operator maps a tenant's calendar scope to a Google calendar id (workspace_calendar_map); every calendar_event.*
-- enqueues a durable push (calendar_sync_queue) which a worker drains through the CalendarSync seam (StubCalendarSync
-- now; the real Google Calendar client behind the same trait once the operator connects Workspace). Pull (Google→Kanzen)
-- is a later operator extension (polling/push channels); this is the push half.

create table workspace_calendar_map (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  scope              text not null default 'all',     -- which events route here (future: per-property/mailbox)
  google_calendar_id text not null,
  direction          text not null default 'push',    -- push | pull | two_way
  created_by         uuid references users(id),
  created_at         timestamptz not null default now(),
  unique (tenant_id, scope)
);

create table calendar_sync_queue (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  event_id        uuid not null,                       -- the calendar_event_refs row
  op              text not null,                       -- create | update | delete
  status          text not null default 'pending',     -- pending | synced | failed
  google_event_id text,                                -- set once pushed (idempotent upsert key on Google)
  attempts        int  not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  synced_at       timestamptz,
  -- one live push per (event, op): re-emitting the same op coalesces rather than duplicating
  unique (event_id, op)
);
create index calendar_sync_queue_pending_idx on calendar_sync_queue (created_at) where status = 'pending';
