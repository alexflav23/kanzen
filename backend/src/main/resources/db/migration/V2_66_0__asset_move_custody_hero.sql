-- F04 (W1.4) — move / custody / hero photo.
-- Location + custody changes are recorded as append-only history (corrections are events, never
-- mutations): each move/custody change updates the asset's current value AND writes a history row
-- with the actor + timestamp. Hero photo references an immutable document (F05).

create table if not exists asset_location_history (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references assets (id),
  location_id uuid references locations (id),   -- the new location (null = unspecified/removed)
  moved_by    uuid,                              -- actor (users.id)
  moved_at    timestamptz not null default now(),
  note        text
);
create index if not exists asset_location_history_asset_idx on asset_location_history (asset_id, moved_at desc);

create table if not exists asset_custody_history (
  id             uuid primary key default gen_random_uuid(),
  asset_id       uuid not null references assets (id),
  custody_status text not null,                  -- with_owner|with_manager|on_loan|in_storage|with_repair_shop|in_transit
  changed_by     uuid,                            -- actor (users.id)
  changed_at     timestamptz not null default now(),
  note           text
);
create index if not exists asset_custody_history_asset_idx on asset_custody_history (asset_id, changed_at desc);

-- hero photo: the asset's primary image, an immutable document in the evidence store (F05)
alter table assets add column if not exists hero_document_id uuid references documents (id);
