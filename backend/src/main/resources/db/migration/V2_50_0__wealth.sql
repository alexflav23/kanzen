-- Wave G Private Wealth (F39–F43) — entities/multi-book on the F18 general ledger.
-- Every wealth account is entity-scoped (F42); statements + net worth derive from gl_splits
-- (F39/F43); investments are lot-accounted (F40); net worth = assets − liabilities + holdings
-- (F41). Principal-private: a `wealth` resource granted ONLY to principal (Manager/Staff 403).

-- F42 — legal/family entities (multi-book); parent_entity_id forms the consolidation tree.
create table wealth_entities (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid,
  name             text not null,
  kind             text not null default 'individual', -- individual|trust|company|spv|partnership|household
  jurisdiction     text,
  base_currency    text not null default 'GBP',
  parent_entity_id uuid references wealth_entities(id),
  created_at       timestamptz not null default now()
);

-- F39 — the chart of accounts is entity-scoped (each entity its own book).
alter table gl_accounts add column if not exists entity_id uuid references wealth_entities(id);
alter table gl_accounts add column if not exists subkind text;   -- e.g. mortgage|loan|credit_line|margin (F41)

-- F40 — securities + a time-series price db + cost-basis lots.
create table securities (
  id          uuid primary key default gen_random_uuid(),
  symbol      text unique not null,
  name        text not null,
  currency    text not null default 'GBP',
  asset_class text not null default 'equity'           -- equity|fund|bond|crypto|private|commodity
);

create table security_prices (
  id          uuid primary key default gen_random_uuid(),
  security_id uuid not null references securities(id),
  price_minor bigint not null,                          -- per-share/unit, minor units
  as_of       date not null,
  source      text,
  unique (security_id, as_of)
);

create table investment_lots (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid,
  entity_id          uuid references wealth_entities(id),
  security_id        uuid not null references securities(id),
  quantity           numeric not null,                  -- fractional shares
  cost_basis_minor   bigint not null,
  acquired_on        date not null default current_date,
  status             text not null default 'open',      -- open|closed
  closed_on          date,
  proceeds_minor     bigint,
  realized_gain_minor bigint,
  created_at         timestamptz not null default now()
);
create index investment_lots_holding_idx on investment_lots (entity_id, security_id) where status = 'open';

-- F41 — persisted net-worth snapshots (the view itself is computed, not stored).
create table net_worth_snapshots (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid,
  entity_id        uuid references wealth_entities(id), -- null = consolidated
  as_of            date not null default current_date,
  assets_minor     bigint not null,
  liabilities_minor bigint not null,
  net_minor        bigint not null,
  currency         text not null default 'GBP',
  created_at       timestamptz not null default now()
);

-- Private Wealth is Principal-private — no Manager carve-out (F41/F42 invariant).
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'wealth', null, 'admin')
on conflict (role_name, resource, field) do nothing;

-- Seed two entities + a security with a price (exercises consolidation + holdings).
insert into wealth_entities (id, owner_id, name, kind, jurisdiction, base_currency) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Flavian (Individual)', 'individual', 'UK', 'GBP'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Wardian Family Trust', 'trust', 'UK', 'GBP')
on conflict (id) do nothing;

insert into securities (id, symbol, name, currency, asset_class) values
  ('41000000-0000-0000-0000-000000000001', 'VWRL', 'Vanguard FTSE All-World', 'GBP', 'fund')
on conflict (id) do nothing;
insert into security_prices (security_id, price_minor, as_of, source) values
  ('41000000-0000-0000-0000-000000000001', 9800, date '2026-05-01', 'seed')
on conflict (security_id, as_of) do nothing;
