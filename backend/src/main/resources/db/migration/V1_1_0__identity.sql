-- F01 identity (specs/01-data-model.md, step 2). Canonical user + login identities.
create table users (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  display_name text not null,
  email        citext unique not null,
  role         text not null default 'staff',     -- principal|manager|staff|property_scoped_manager
  status       text not null default 'invited',    -- invited|active|suspended
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table login_identities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id),
  provider      text not null,                      -- cognito_native|google|apple|passkey
  cognito_sub   text not null,
  email_at_link citext,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  unique (provider, cognito_sub)
);
create index login_identities_user_idx on login_identities (user_id);
