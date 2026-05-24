-- F35 — products/stock permissions + a seeded consumables shelf (varied stock states).
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'product', null, 'write'),
  ('staff',   'product', null, 'read')
on conflict (role_name, resource, field) do nothing;

insert into products (id, owner_id, property_id, name, preferred_spec, unit, stock_status) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Nespresso pods',      'Arpeggio', 'box',    'low'),
  ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Dishwasher tablets',  'Finish',   'box',    'in_stock'),
  ('e0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Olive oil',           'Frantoia', 'bottle', 'out')
on conflict (id) do nothing;
