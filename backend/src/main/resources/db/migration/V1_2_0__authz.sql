-- F02 authorization (specs/01-data-model.md, step 3). Roles + resource/field rules.
create table roles (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into roles (name, description, is_system) values
  ('principal',                'Full access incl. valuations/ledger',          true),
  ('manager',                  'Operational; no valuations/ledger/balances',   true),
  ('staff',                    'Scoped: own tasks/lists, raise issues',        true),
  ('property_scoped_manager',  'Manager scoped to one property',               true),
  ('maintenance',              'Service items without seeing price',           false);

create table permission_rules (
  id        uuid primary key default gen_random_uuid(),
  role_name text not null references roles(name),
  resource  text not null,        -- e.g. asset, asset_event, ledger, '*'
  field     text,                 -- null = resource-level; non-null = field/attribute override
  level     text not null check (level in ('none','read','write','admin')),
  unique (role_name, resource, field)
);

insert into permission_rules (role_name, resource, field, level) values
  -- Principal: admin on everything
  ('principal', '*', null, 'admin'),
  -- Manager: operational write on assets, but valuation/ledger/balance denied (field-level)
  ('manager', 'asset', null, 'write'),
  ('manager', 'asset', 'market_value', 'none'),
  ('manager', 'asset', 'insured_value', 'none'),
  ('manager', 'asset', 'valuation_snapshots', 'none'),
  ('manager', 'asset_event', null, 'write'),
  ('manager', 'ledger', null, 'none'),
  ('manager', 'bank_account', 'balance', 'none'),
  -- Staff: tasks only
  ('staff', 'task', null, 'write'),
  ('staff', 'asset', null, 'none'),
  -- Maintenance: read an item + log service events, but never the price
  ('maintenance', 'asset', null, 'read'),
  ('maintenance', 'asset', 'acquisition_cost', 'none'),
  ('maintenance', 'asset', 'market_value', 'none'),
  ('maintenance', 'asset_event', null, 'write');
