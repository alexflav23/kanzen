-- F02 v2 — enterprise RBAC (specs/F02v2-enterprise-rbac.md): permission sets, role composition +
-- inheritance, teams (nested), multi-role users. ADDITIVE: nothing is seeded into these tables yet, so
-- a user still resolves to exactly their primary `users.role` (behaviour unchanged) until configured.

-- role inheritance: a role extends a parent (inherits its rules + sets)
alter table roles add column if not exists parent_role text references roles (name);

-- reusable permission sets (bundles of grants)
create table if not exists permission_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- a grant in a set: object × action (+ optional field), with scope + allow/deny effect
create table if not exists permission_set_grants (
  set_id   uuid not null references permission_sets (id) on delete cascade,
  resource text not null,                 -- or '*'
  action   text not null default '*',     -- verb, or '*' = all actions on the resource
  field    text not null default '',      -- '' = resource/action-level; else a field-level grant
  scope    text not null default 'all',   -- all|property|team|own
  effect   text not null default 'allow', -- allow|deny
  primary key (set_id, resource, action, field)
);

-- roles are composed of sets
create table if not exists role_sets (
  role_name text not null references roles (name) on delete cascade,
  set_id    uuid not null references permission_sets (id) on delete cascade,
  primary key (role_name, set_id)
);

-- teams (nestable) — members inherit a team's roles AND its ancestors' roles
create table if not exists teams (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  parent_team_id uuid references teams (id),
  description    text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create table if not exists team_members (
  team_id uuid not null references teams (id) on delete cascade,
  user_id uuid not null,                  -- the actor (no FK: not every principal has a users row)
  primary key (team_id, user_id)
);
create index if not exists team_members_user_idx on team_members (user_id);
create table if not exists team_roles (
  team_id   uuid not null references teams (id) on delete cascade,
  role_name text not null references roles (name) on delete cascade,
  primary key (team_id, role_name)
);
create table if not exists team_property_scopes (
  team_id     uuid not null references teams (id) on delete cascade,
  property_id uuid not null references properties (id),
  primary key (team_id, property_id)
);

-- multi-role: a user can hold several roles (in addition to the primary users.role)
create table if not exists user_roles (
  user_id   uuid not null,
  role_name text not null references roles (name) on delete cascade,
  primary key (user_id, role_name)
);
