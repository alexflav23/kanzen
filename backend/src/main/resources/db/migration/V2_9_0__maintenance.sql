-- F11 maintenance plans (specs/F11). Roll-forward on completion + logs.
create table maintenance_plans (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid,
  property_id         uuid references properties(id),
  asset_id            uuid references assets(id),
  vendor              text,
  frequency           text not null,            -- monthly|quarterly|semi_annually|annually
  next_due            date,
  lead_days           int not null default 5,
  expected_cost_minor bigint,
  currency            text,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

create table maintenance_logs (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references maintenance_plans(id),
  performed_on date,
  cost_minor  bigint,
  currency    text,
  notes       text,
  created_at  timestamptz not null default now()
);
