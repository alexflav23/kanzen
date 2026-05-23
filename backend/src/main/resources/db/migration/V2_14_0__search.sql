-- F28 search (specs/F28). Postgres full-text index over a denormalised projection.
create table search_index (
  entity_type text not null,
  entity_id   uuid not null,
  owner_id    uuid,
  title       text not null,
  subtitle    text,
  fts         tsvector,
  primary key (entity_type, entity_id)
);
create index search_index_fts on search_index using gin (fts);
