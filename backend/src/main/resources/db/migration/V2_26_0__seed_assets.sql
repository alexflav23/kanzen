-- F04 — seed a small, realistic registry across verticals (owned by the Principal).
-- Categories use fixed ids so assets + later seeds can reference them.
insert into categories (id, owner_id, name, slug, sort_order) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Watches',   'watches',   1),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Guitars',   'guitars',   2),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Art',       'art',       3),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Glassware', 'glassware', 4)
on conflict (id) do nothing;

insert into assets (id, owner_id, title, maker, category_id, vertical, tracking_mode, quantity,
                    acquisition_cost_minor, acquisition_currency, ownership_status, attributes) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Royal Oak 15500ST', 'Audemars Piguet',
   '30000000-0000-0000-0000-000000000001', 'watch', 'unique', 1, 3500000, 'GBP', 'owned',
   '{"serial":"AP-15500","movement":"automatic","case_mm":41}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Submariner Date', 'Rolex',
   '30000000-0000-0000-0000-000000000001', 'watch', 'unique', 1, 1200000, 'GBP', 'owned',
   '{"serial":"RX-126610","movement":"automatic","case_mm":41}'::jsonb),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '1959 Les Paul Standard', 'Gibson',
   '30000000-0000-0000-0000-000000000002', 'guitar', 'unique', 1, 28000000, 'GBP', 'owned',
   '{"year":1959,"body_wood":"mahogany","scale_in":24.75}'::jsonb),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Untitled (Abstract)', 'Gerhard Richter',
   '30000000-0000-0000-0000-000000000003', 'art', 'unique', 1, 95000000, 'GBP', 'owned',
   '{"medium":"oil on canvas","year":1994}'::jsonb),
  ('40000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Cumbria Crystal Tumblers', 'Cumbria Crystal',
   '30000000-0000-0000-0000-000000000004', 'glassware', 'grouped_quantity', 6, 42000, 'GBP', 'owned',
   '{}'::jsonb)
on conflict (id) do nothing;
