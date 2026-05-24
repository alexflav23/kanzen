-- F10 — people/HR permissions + the real household team (linked to their user accounts).
-- Managers run HR; Staff read their own record only (own-only enforced in the service).

-- Link an employment record to its login user (F01/F02) — added to the F10 table.
alter table employment_records add column if not exists user_id uuid references users(id);

insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'person', null, 'write'),
  ('staff',   'person', null, 'read')
on conflict (role_name, resource, field) do nothing;

-- The team. user_id links each record to the login user (F01). Siti's permit expires
-- within 60 days to exercise the expiry surfacing (F10 AC1). owner = the Principal.
insert into employment_records (id, owner_id, user_id, name, role, jurisdiction, property_id, permit_expiry) values
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   'Lorna', 'House Manager', 'uk', '20000000-0000-0000-0000-000000000001', null),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003',
   'Marcia', 'Housekeeper', 'uk', '20000000-0000-0000-0000-000000000001', null),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004',
   'Siti', 'Housekeeper', 'sg', '20000000-0000-0000-0000-000000000002', current_date + 50)
on conflict (id) do nothing;
