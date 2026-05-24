-- F09 — vendor permissions + a seeded directory with property-scoped approval.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'vendor', null, 'write'),
  ('staff',   'vendor', null, 'read')
on conflict (role_name, resource, field) do nothing;

-- Marcia works at Wardian (F02 property scope) — drives vendor/people scope (F09 AC4).
insert into user_property_scopes (user_id, property_id) values
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Vendors: one current-insurance plumber + one expired-insurance electrician at Wardian,
-- and an HVAC vendor approved for Singapore only (exercises selectability + scope).
insert into vendors (id, owner_id, name, type, trade, insurance_until) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Thames Plumbing',  'business', 'plumber',     current_date + 200),
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Volt Electrics',   'business', 'electrician', current_date - 10),
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Marina Aircon',    'business', 'hvac',        current_date + 300)
on conflict (id) do nothing;

insert into vendor_property_link (vendor_id, property_id) values
  ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002')
on conflict do nothing;
