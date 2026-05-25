-- F08 — a realistic Lists dataset matching the working model: cadence + next-order, categories,
-- recurring staples, and staff proposals that need approval (with notes + est. cost). Marcia (staff,
-- ...003) manages the household lists.

-- Upgrade the seeded grocery list into "Grocery — Wardian" (weekly, Tuesday delivery, Waitrose).
update shopping_lists
  set name = 'Grocery — Wardian', type = 'grocery', cycle = 'weekly', vendor = 'Waitrose',
      next_order = current_date + 3
  where id = 'c0000000-0000-0000-0000-000000000001';

-- Enrich the two existing items + add a realistic spread across categories.
update list_items set category = 'Dairy',  added_by = '10000000-0000-0000-0000-000000000003' where id = 'c1000000-0000-0000-0000-000000000001';
update list_items set category = 'Pantry', added_by = '10000000-0000-0000-0000-000000000003', recurring = true where id = 'c1000000-0000-0000-0000-000000000002';
update list_items set status = 'added' where id = 'c1000000-0000-0000-0000-000000000002';

insert into list_items (id, list_id, name, qty, category, status, recurring, note, est_price_minor, added_by) values
  ('c1000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Sourdough loaf',      1, 'Bakery',  'added',          true,  null,                                                   null, '10000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Free-range eggs',     1, 'Dairy',   'added',          true,  null,                                                   null, '10000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 'Greek yoghurt',       2, 'Dairy',   'added',          true,  null,                                                   null, '10000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 'Extra-virgin olive oil', 1, 'Pantry', 'added',        true,  null,                                                   null, '10000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'Sea bass fillets',    4, 'Fish',    'needs_approval', false, 'For Thu dinner — Dorchester is dropping a course request', null, '10000000-0000-0000-0000-000000000003'),
  ('c1000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 'Truffle (fresh)',     1, 'Produce', 'needs_approval', false, 'Black winter truffle for the weekend',                 9500, '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- A second weekly list for the Singapore residence + a monthly supplies list.
insert into shopping_lists (id, owner_id, property_id, name, type, vendor, cycle, next_order) values
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Grocery — Singapore', 'grocery',  'RedMart',  'weekly',  current_date + 5),
  ('c0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Supplies — Wardian',  'supplies', null,       'monthly', current_date + 12)
on conflict (id) do nothing;

insert into list_items (id, list_id, name, qty, category, status, recurring, added_by) values
  ('c1000000-0000-0000-0000-000000000101', 'c0000000-0000-0000-0000-000000000002', 'Jasmine rice 5kg', 1, 'Pantry',    'added', true, '10000000-0000-0000-0000-000000000004'),
  ('c1000000-0000-0000-0000-000000000201', 'c0000000-0000-0000-0000-000000000003', 'Dishwasher tablets', 2, 'Cleaning', 'needs_approval', false, '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;
