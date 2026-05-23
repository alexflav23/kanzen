-- F07 calendar (specs/F07). Two-way Google Calendar sync; dedup by google_event_id.
create table calendar_event_refs (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid,
  google_event_id text unique,
  title           text not null,
  start_on        date,
  category        text,
  source          text not null default 'manual',  -- agent|maintenance|manual|leave|task
  source_id       uuid,
  created_at      timestamptz not null default now()
);
