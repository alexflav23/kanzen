-- F17 expenses & approvals (specs/F17). Threshold routing to the Principal.
create table expenses (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  property_id  uuid references properties(id),
  category_id  uuid references categories(id),
  payee        text,
  description  text,
  amount_minor bigint not null,
  currency     text not null,
  incurred_on  date,
  status       text not null default 'draft',  -- draft|pending_approval|approved|rejected
  requested_by uuid,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table approvals (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid,
  subject_type       text not null,                 -- expense|list_item|maintenance
  subject_id         uuid not null,
  threshold_minor    bigint not null,
  threshold_currency text not null,
  status             text not null default 'pending', -- pending|approved|rejected
  decided_by         uuid,
  decided_at         timestamptz,
  created_at         timestamptz not null default now()
);
