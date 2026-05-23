-- F15 bills & recurring schedule (specs/F15). Agent reconciliation flags >= ±15% variance.
create table bills (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid,
  payee           text not null,
  property_id     uuid references properties(id),
  category        text,
  amount_minor    bigint not null,
  currency        text not null,
  frequency       text,
  next_due        date,
  lead_days       int not null default 5,
  auto            boolean not null default false,
  last_seen_minor bigint,
  prev_seen_minor bigint,
  variance_flag   boolean not null default false,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
