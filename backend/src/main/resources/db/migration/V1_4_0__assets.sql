-- F04 asset registry core (specs/01-data-model.md, step 5). JSONB attributes (not EAV).
create table categories (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  parent_id  uuid references categories(id),
  name       text not null,
  slug       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table assets (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid,
  title                  text not null,
  maker                  text,
  description            text,
  category_id            uuid references categories(id),
  vertical               text,
  tracking_mode          text not null default 'unique',   -- unique|grouped_quantity|structured_set
  quantity               int  not null default 1,
  parent_asset_id        uuid references assets(id),
  acquisition_date       date,
  acquisition_cost_minor bigint,
  acquisition_currency   text,
  ownership_status       text not null default 'owned',
  condition_status       text,
  location_id            uuid references locations(id),
  custody_status         text not null default 'with_owner',
  attributes             jsonb not null default '{}',
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);
create index assets_category_idx on assets (category_id);
create index assets_attributes_gin on assets using gin (attributes);

create table tags (id uuid primary key default gen_random_uuid(), owner_id uuid, name text not null, slug text);
create table asset_tags (asset_id uuid references assets(id), tag_id uuid references tags(id), primary key (asset_id, tag_id));

create table collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid, name text not null, description text,
  visibility text not null default 'principal', currency text,
  created_at timestamptz not null default now(), deleted_at timestamptz
);
create table collection_members (collection_id uuid references collections(id), asset_id uuid references assets(id), primary key (collection_id, asset_id));
