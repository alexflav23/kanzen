-- F23 data quality — per-asset quality flags (completeness is computed on demand from the
-- asset's photo/category/location/proof). The completeness cache table is deferred (sandbox
-- computes live). Detection upserts open flags idempotently (one open flag per asset+kind).
create table asset_quality_flags (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  asset_id    uuid references assets(id),
  kind        text not null check (kind in
                ('missing_photo','missing_location','missing_proof','expensive_no_proof',
                 'suspected_duplicate','anomaly','no_category')),
  severity    text not null default 'medium' check (severity in ('low','medium','high')),
  detail      jsonb not null default '{}',
  status      text not null default 'open' check (status in ('open','resolved','dismissed')),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);
-- idempotent scan: at most one OPEN flag per (asset, kind)
create unique index asset_quality_flags_open_idx on asset_quality_flags (asset_id, kind) where status = 'open';

-- F23 §2 — Principal-private registry health; Manager sees operational completeness; Staff none.
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'data_quality', null, 'write'),
  ('manager',   'data_quality', null, 'read')
on conflict (role_name, resource, field) do nothing;
