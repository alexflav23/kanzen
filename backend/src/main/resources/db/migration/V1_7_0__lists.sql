-- F08 lists (specs/F08). Staff propose -> Principal approves; items carry a buy URL.
create table shopping_lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  property_id uuid references properties(id),
  name        text not null,
  type        text not null default 'grocery',
  vendor      text,
  cycle       text,
  next_order  date,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table list_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references shopping_lists(id),
  name            text not null,
  category        text,
  qty             int not null default 1,
  url             text,                              -- e.g. an Amazon/Harrods buy link (F33)
  note            text,
  status          text not null default 'added',     -- needs_approval|added|declined
  recurring       boolean not null default false,
  est_price_minor bigint,
  currency        text,
  added_by        uuid,
  approved_by     uuid,
  created_at      timestamptz not null default now()
);
create index list_items_list_idx on list_items (list_id);
