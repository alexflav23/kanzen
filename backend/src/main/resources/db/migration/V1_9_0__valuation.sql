-- F20 valuation snapshots (specs/F20). Principal-private values; latest-by-kind.
create table asset_valuation_snapshots (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  asset_id     uuid not null references assets(id),
  kind         text not null,          -- market|insured|appraisal|acquisition|realised
  amount_minor bigint not null,
  currency     text not null,
  valued_at    date not null default current_date,
  source       text,
  created_at   timestamptz not null default clock_timestamp()  -- distinct per row for latest() tiebreak
);
create index asset_valuations_asset_idx on asset_valuation_snapshots (asset_id, kind, valued_at desc);
