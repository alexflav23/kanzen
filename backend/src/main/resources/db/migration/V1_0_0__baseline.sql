-- F00 baseline (specs/01-data-model.md, step 1): extensions + the cross-cutting audit log.
create extension if not exists pgcrypto;
create extension if not exists citext;

create table audit_log_entries (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  actor_type  text not null,                 -- user | agent | system
  actor_id    uuid,
  action      text not null,
  target_type text,
  target_id   uuid,
  detail      jsonb,
  owner_id    uuid
);

create index audit_log_entries_at_idx on audit_log_entries (at desc);
