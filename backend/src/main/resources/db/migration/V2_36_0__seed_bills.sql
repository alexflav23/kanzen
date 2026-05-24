-- F15/F16 — bill permissions + a seeded recurring schedule (finance carve-out).
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'bill', null, 'write')
on conflict (role_name, resource, field) do nothing;

insert into bills (id, owner_id, payee, property_id, category, amount_minor, currency, frequency, next_due, auto) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Thames Water', '20000000-0000-0000-0000-000000000001', 'utilities', 14500, 'GBP', 'quarterly', current_date + 20, false),
  ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'British Gas',  '20000000-0000-0000-0000-000000000001', 'utilities', 22000, 'GBP', 'monthly',   current_date + 8,  true)
on conflict (id) do nothing;
