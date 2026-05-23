-- F09 vendors & contacts (specs/F09). Property-scoped approval + compliance expiry.
create table vendors (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid,
  name            text not null,
  type            text not null default 'business',  -- business|individual
  trade           text,
  nda_until       date,
  insurance_until date,
  rating          numeric,
  attributes      jsonb not null default '{}',       -- freehand custom fields (F33)
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table vendor_property_link (
  vendor_id   uuid references vendors(id),
  property_id uuid references properties(id),
  primary key (vendor_id, property_id)
);
