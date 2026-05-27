-- F21 — provenance party-roles: the people/firms in an asset's history (maker, restorer, appraiser, prior owner,
-- dealer, insurer). The provenance archive that makes the registry "kanzen". Registry-private (gated on `asset`).
create table asset_parties (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  asset_id   uuid not null references assets (id),
  role       text not null,            -- maker|restorer|appraiser|prior_owner|dealer|insurer|other
  name       text not null,
  note       text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index asset_parties_asset_idx on asset_parties (asset_id);

-- Seed provenance for the seeded watches + the painting (rich real data, not mocks).
insert into asset_parties (asset_id, role, name, note) values
  ('40000000-0000-0000-0000-000000000001', 'maker',       'Audemars Piguet',        'Le Brassus, Switzerland'),
  ('40000000-0000-0000-0000-000000000001', 'dealer',      'The Hour Glass',         'Purchased new, 2021'),
  ('40000000-0000-0000-0000-000000000001', 'appraiser',   'Watchfinder & Co.',      'Market valuation, 2024'),
  ('40000000-0000-0000-0000-000000000002', 'maker',       'Rolex',                  'Geneva, Switzerland'),
  ('40000000-0000-0000-0000-000000000002', 'prior_owner', 'Private collection',     'Acquired at auction'),
  ('40000000-0000-0000-0000-000000000004', 'maker',       'Unattributed',           'Mid-century abstract'),
  ('40000000-0000-0000-0000-000000000004', 'restorer',    'Lumière Conservation',   'Surface clean + reframe, 2023');
