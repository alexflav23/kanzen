-- F10 people / HR (specs/F10). Permit/review expiry reminders.
create table employment_records (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,
  name          text not null,
  role          text,
  jurisdiction  text,
  property_id   uuid references properties(id),
  permit_expiry date,
  review_due    date,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
