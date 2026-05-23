-- F03 properties & locations (specs/01-data-model.md, step 4).
create table properties (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid,
  name             text not null,
  address          text,
  jurisdiction     text,
  type             text,
  ownership        text,
  default_currency text not null default 'GBP',
  status           text not null default 'active',  -- active|archived|sold
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- typed nested location tree (room/area/cabinet/shelf/case/garage/...)
create table locations (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  property_id uuid not null references properties(id),
  parent_id   uuid references locations(id),
  kind        text not null,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index locations_property_idx on locations (property_id, parent_id);

create table defects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  property_id uuid not null references properties(id),
  location_id uuid references locations(id),
  title       text not null,
  severity    text not null default 'low',     -- low|medium|high
  status      text not null default 'open',     -- open|in_progress|resolved|wont_fix
  reported_by uuid,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
