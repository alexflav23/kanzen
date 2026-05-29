-- F32 / NL-2 — the RAG index: one rendered "document" per entity (current state + timeline + linked text),
-- kept fresh by the F34 event backbone (an IndexConsumer re-renders + upserts on every event). Sandbox
-- retrieval is Postgres FTS; prod adds a pgvector `embedding` column + Bedrock behind the same seam.
create table entity_documents (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,                 -- asset|person|document|expense|property
  entity_id   uuid not null,
  owner_id    uuid,                           -- scope columns (stored now; used when scoped multi-role NL lands)
  property_id uuid,
  visibility  text not null default 'household',
  title       text not null,
  body        text not null default '',
  fts         tsvector generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored,
  indexed_at  timestamptz not null default now(),
  unique (entity_type, entity_id)
);
create index entity_documents_fts_idx on entity_documents using gin (fts);
create index entity_documents_owner_idx on entity_documents (owner_id);
