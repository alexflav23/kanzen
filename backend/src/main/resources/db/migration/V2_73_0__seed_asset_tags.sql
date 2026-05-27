-- F04 — seed a few real tags + asset links so the Inventory Tag facet is populated (rich seed data, not mocks).
-- Tags are crowd/owner-defined; these mirror how the household actually labels things.

insert into tags (id, owner_id, name, slug) values
  ('4a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Heirloom',   'heirloom'),
  ('4a000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Insured',    'insured'),
  ('4a000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'On display', 'on-display')
on conflict (id) do nothing;

insert into entity_tags (tag_id, entity_type, entity_id) values
  -- Heirloom: the watches + the painting
  ('4a000000-0000-0000-0000-000000000001', 'asset', '40000000-0000-0000-0000-000000000001'), -- Royal Oak
  ('4a000000-0000-0000-0000-000000000001', 'asset', '40000000-0000-0000-0000-000000000002'), -- Submariner
  ('4a000000-0000-0000-0000-000000000001', 'asset', '40000000-0000-0000-0000-000000000004'), -- Abstract
  -- Insured: high-value items
  ('4a000000-0000-0000-0000-000000000002', 'asset', '40000000-0000-0000-0000-000000000001'), -- Royal Oak
  ('4a000000-0000-0000-0000-000000000002', 'asset', '40000000-0000-0000-0000-000000000002'), -- Submariner
  ('4a000000-0000-0000-0000-000000000002', 'asset', '40000000-0000-0000-0000-000000000006'), -- Range Rover
  -- On display: the art + glassware
  ('4a000000-0000-0000-0000-000000000003', 'asset', '40000000-0000-0000-0000-000000000004'), -- Abstract
  ('4a000000-0000-0000-0000-000000000003', 'asset', '40000000-0000-0000-0000-000000000005')  -- Tumblers
on conflict (tag_id, entity_type, entity_id) do nothing;
