-- F21 warranty / insurance (specs/F21). Principal-private insurance values.
create table asset_warranties (
  id         uuid primary key default gen_random_uuid(),
  asset_id   uuid not null references assets(id),
  provider   text,
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now()
);

create table asset_insurance (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references assets(id),
  insured             boolean not null default false,
  policy_ref          text,
  insurer             text,
  insured_value_minor bigint,
  renewal_on          date,
  created_at          timestamptz not null default clock_timestamp()
);
