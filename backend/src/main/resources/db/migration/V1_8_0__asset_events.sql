-- F19 asset lifecycle events (specs/F19). Timeline + lifetime cost.
create table asset_events (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  asset_id    uuid not null references assets(id),
  type        text not null,           -- acquired|serviced|cleaned|repaired|moved|appraised|sold|...
  occurred_at timestamptz not null default now(),
  cost_minor  bigint,
  currency    text,
  party       text,
  note        text,
  created_at  timestamptz not null default now()
);
create index asset_events_asset_idx on asset_events (asset_id, occurred_at desc);
