-- F05 documents (specs/F05). Immutable originals (S3 in production); polymorphic links.
create table documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  name        text not null,
  category    text not null default 'other',
  content_type text,
  size_bytes  bigint,
  s3_key      text,
  sha256      text,
  immutable   boolean not null default true,
  visibility  text not null default 'household',  -- household|principal_private
  source      text not null default 'manual',     -- manual|agent|import
  property_id uuid references properties(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table document_links (
  document_id uuid not null references documents(id),
  target_type text not null,   -- asset|bank_transaction|property|person|vendor|receipt|defect
  target_id   uuid not null,
  role        text,
  primary key (document_id, target_type, target_id)
);
create index document_links_target_idx on document_links (target_type, target_id);
