-- F33 extensibility (specs/F33). Polymorphic tags + user-defined infinite taxonomies.
-- (reuses the `tags` table from V1_4_0; adds polymorphic entity_tags + taxonomies)
create table entity_tags (
  tag_id      uuid not null references tags(id),
  entity_type text not null,
  entity_id   uuid not null,
  primary key (tag_id, entity_type, entity_id)
);

create table taxonomies (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  name       text not null,
  applies_to text not null default 'any',
  is_system  boolean not null default false,
  created_at timestamptz not null default now()
);

create table taxonomy_nodes (
  id          uuid primary key default gen_random_uuid(),
  taxonomy_id uuid not null references taxonomies(id),
  parent_id   uuid references taxonomy_nodes(id),
  name        text not null,
  sort_order  int not null default 0
);

create table entity_taxonomy_links (
  taxonomy_node_id uuid not null references taxonomy_nodes(id),
  entity_type      text not null,
  entity_id        uuid not null,
  primary key (taxonomy_node_id, entity_type, entity_id)
);
