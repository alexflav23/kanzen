-- F04 (W1.5) — asset groups: structural **peer** groupings (e.g. four chairs from one order),
-- distinct from `parent_asset_id` structured sets (hierarchy) and from logical `collections`.
create table if not exists asset_groups (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  name       text not null,
  kind       text not null default 'other',  -- order|set|rig|other
  notes      text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists asset_group_members (
  group_id uuid not null references asset_groups (id),
  asset_id uuid not null references assets (id),
  primary key (group_id, asset_id)
);
create index if not exists asset_group_members_asset_idx on asset_group_members (asset_id);
