-- F02 — optional property scope. A user WITH scope rows sees only those properties;
-- a user with none inherits their role's full read (Principal/Manager/Staff see all).
-- Scope is orthogonal to role, and (later) the same mechanism scopes entities (F42).
create table user_property_scopes (
  user_id     uuid not null references users(id),
  property_id uuid not null references properties(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, property_id)
);

-- Siti works only at the Singapore residence — scope her there (exercises F02 scope).
insert into user_property_scopes (user_id, property_id) values
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002')
on conflict do nothing;
