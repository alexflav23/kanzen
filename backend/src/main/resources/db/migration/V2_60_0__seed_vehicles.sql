-- F04/F22 — Vehicles as an asset-registry VERTICAL (not a bespoke module): the generic feature set
-- (cards, detail, typed attributes, valuation, documents, collections) handles vehicles. This seeds
-- the "Vehicles" category, a 'vehicle' typed-attribute template, and one sample vehicle so the
-- Vehicles surface (a vertical-filtered Inventory) isn't empty.

insert into categories (id, owner_id, name, slug, sort_order) values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Vehicles', 'vehicles', 5)
on conflict (id) do nothing;

insert into category_templates (vertical_key, name, schema) values
  ('vehicle', 'Vehicle', '[
     {"key":"make","type":"string","required":false},
     {"key":"model","type":"string","required":false},
     {"key":"year","type":"number","required":false},
     {"key":"registration","type":"string","required":false},
     {"key":"vin","type":"string","required":false},
     {"key":"mileage","type":"number","required":false}
   ]'::jsonb)
on conflict do nothing;

insert into assets (id, owner_id, title, maker, category_id, vertical, tracking_mode, quantity,
                    acquisition_cost_minor, acquisition_currency, ownership_status, attributes) values
  ('40000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001',
   'Range Rover Autobiography', 'Land Rover', '30000000-0000-0000-0000-000000000005', 'vehicle', 'unique', 1,
   12500000, 'GBP', 'owned',
   '{"make":"Land Rover","model":"Range Rover Autobiography","year":2023,"registration":"LR23 ABC","vin":"SALGA2BJ7PA000000","mileage":8200}'::jsonb)
on conflict (id) do nothing;
