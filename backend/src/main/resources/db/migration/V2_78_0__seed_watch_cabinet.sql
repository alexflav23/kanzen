-- W4 (F03) — location-tree depth: a richer 'cabinet' node nested under the Walk-in Wardrobe, holding the
-- watches (moved off the area into the cabinet). Demonstrates a non-room kind + a deep nest + per-node items:
-- Primary Bedroom › Walk-in Wardrobe (area) › Watch Cabinet (cabinet) › [Royal Oak, Submariner].
insert into locations (id, owner_id, property_id, parent_id, kind, name, floor, area, notes, sort_order) values
  ('60000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000009','cabinet','Watch Cabinet','52', null, 'Climate-controlled winder cabinet', 1)
on conflict (id) do nothing;

update assets set location_id = '60000000-0000-0000-0000-000000000010'
where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002');
