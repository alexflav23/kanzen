-- F08 — lists are operational: Manager + Staff write (Staff proposals need approval);
-- Principal via '*'. Seed a grocery list with a staple + a needs-approval item.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'list', null, 'write'),
  ('staff',   'list', null, 'write')
on conflict (role_name, resource, field) do nothing;

insert into shopping_lists (id, owner_id, property_id, name, type, vendor) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Weekly groceries', 'grocery', 'Waitrose')
on conflict (id) do nothing;

insert into list_items (id, list_id, name, qty, status, recurring) values
  ('c1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Whole milk',    2, 'added',          true),
  ('c1000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Coffee beans',  1, 'needs_approval', false)
on conflict (id) do nothing;
