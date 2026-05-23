-- F24 restructure (specs/F24). Auditable, non-destructive merge/split/regroup.
create table restructure_operations (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  kind         text not null,    -- merge|split|regroup|convert|reallocate
  inputs       jsonb not null,
  outputs      jsonb not null,
  performed_by uuid,
  performed_at timestamptz not null default now()
);
