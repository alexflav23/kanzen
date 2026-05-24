-- F24 legacy onboarding & restructure — asset lineage + auditable, reversible operations.
-- Non-destructive: originals are superseded/linked (never deleted); cost basis is reallocated
-- explicitly and the before/after is recorded so every reshape stays explainable & reversible.
alter table assets add column if not exists uncertainty_note  text;
alter table assets add column if not exists restructured_from  jsonb;      -- lineage (array of source asset ids)
alter table assets add column if not exists superseded_at      timestamptz; -- merged/split-away originals (kept, not deleted)
alter table assets add column if not exists superseded_by      uuid references assets(id);

alter table restructure_operations add column if not exists cost_basis_before jsonb;
alter table restructure_operations add column if not exists cost_basis_after  jsonb;
alter table restructure_operations add column if not exists reversible        boolean not null default true;
alter table restructure_operations add column if not exists reversed_by       uuid references restructure_operations(id);

-- Legacy create + restructure are Manager-write on `asset` (already granted to Manager via the
-- registry carve-out); no new resource needed.
