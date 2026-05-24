-- Seed the real household (plan Phase 0.5). These are the actual users and properties,
-- not test fixtures — Kanzen is single-tenant software the Principal runs for themselves.
-- Idempotent (on conflict do nothing) so it is safe to re-run and safe in every env.
-- Emails are placeholders on the kanzen.local household domain; update in place when real.
-- Deterministic UUIDs let later seeds + specs reference these rows by id.

-- The people. owner_id is set to the Principal (Toby) below, after the rows exist.
insert into users (id, display_name, email, role, status) values
  ('10000000-0000-0000-0000-000000000001', 'Toby',   'toby@kanzen.local',   'principal', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'Lorna',  'lorna@kanzen.local',  'manager',   'active'),
  ('10000000-0000-0000-0000-000000000003', 'Marcia', 'marcia@kanzen.local', 'staff',     'active'),
  ('10000000-0000-0000-0000-000000000004', 'Siti',   'siti@kanzen.local',   'staff',     'active')
on conflict (email) do nothing;

-- The Principal owns the household; every domain row carries owner_id (house rule).
update users set owner_id = '10000000-0000-0000-0000-000000000001'
  where owner_id is null
    and id in ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004');

-- The two real properties.
insert into properties (id, owner_id, name, address, jurisdiction, type, ownership, default_currency, status) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'Wardian — Apt 5206', 'Wardian, 9 Wards Place, London E14', 'GB', 'apartment', 'owned', 'GBP', 'active'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Singapore Residence', 'Singapore', 'SG', 'apartment', 'owned', 'SGD', 'active')
on conflict (id) do nothing;
