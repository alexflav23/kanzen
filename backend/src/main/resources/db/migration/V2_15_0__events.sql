-- F34 event backbone (specs/F34). Transactional outbox -> Pulsar (in production).
create table event_outbox (
  id             uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id   uuid,
  event_type     text not null,
  payload        jsonb not null default '{}',
  published_at   timestamptz,
  created_at     timestamptz not null default clock_timestamp()
);
create index event_outbox_unpublished_idx on event_outbox (created_at) where published_at is null;
