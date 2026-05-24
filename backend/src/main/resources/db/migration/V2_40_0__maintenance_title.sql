-- F11 — maintenance plans gain a title; operational permissions + a seeded plan.
alter table maintenance_plans add column if not exists title text;

insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'maintenance', null, 'write'),
  ('staff',   'maintenance', null, 'read')
on conflict (role_name, resource, field) do nothing;

insert into maintenance_plans (id, owner_id, title, property_id, vendor, frequency, next_due, lead_days, expected_cost_minor, currency) values
  ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Boiler service',
   '20000000-0000-0000-0000-000000000001', 'Thames Plumbing', 'annually', current_date + 25, 14, 18000, 'GBP')
on conflict (id) do nothing;
