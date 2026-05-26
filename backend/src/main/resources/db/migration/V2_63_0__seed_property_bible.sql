-- F03 — give the property Bibles a real body: a room/location tree per residence and a few open
-- defects, so the Rooms + Defects tabs aren't empty. Owner = Toby (principal); staff-raised
-- defects are reported_by Marcia.

-- Wardian — Apt 5206 (property ...001), floor 52.
insert into locations (id, owner_id, property_id, parent_id, kind, name, floor, area, notes, sort_order) values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Living Room',     '52', '48 m²', null, 1),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Kitchen',         '52', '22 m²', null, 2),
  ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Primary Bedroom', '52', '34 m²', null, 3),
  ('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Primary Bath',    '52', '14 m²', null, 4),
  ('60000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Study',           '52', '12 m²', null, 5),
  ('60000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Guest Bedroom',   '52', '18 m²', null, 6),
  ('60000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001', null, 'room', 'Balcony',         '52', '9 m²',  null, 7),
  ('60000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','area','Pantry',          '52', null, null, 1),
  ('60000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003','area','Walk-in Wardrobe', '52', null, null, 1)
on conflict (id) do nothing;

-- Singapore Residence (property ...002).
insert into locations (id, owner_id, property_id, parent_id, kind, name, floor, area, notes, sort_order) values
  ('60000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002', null, 'room', 'Living Room',    null, null, null, 1),
  ('60000000-0000-0000-0000-000000000102','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002', null, 'room', 'Kitchen',        null, null, null, 2),
  ('60000000-0000-0000-0000-000000000103','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002', null, 'room', 'Master Bedroom', null, null, null, 3)
on conflict (id) do nothing;

-- Open defects (the property's punch list). Reported by Marcia (staff).
insert into defects (id, owner_id, property_id, location_id, title, description, severity, status, reported_by) values
  ('61000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','Dishwasher not draining fully','Standing water after a cycle — likely the filter or pump.', 'medium','open',       '10000000-0000-0000-0000-000000000003'),
  ('61000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','Hallway downlight flickering','Intermittent flicker on the living-room track.',          'low',   'open',       '10000000-0000-0000-0000-000000000003'),
  ('61000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000007','Balcony door seal worn','Draught at the sliding door; reseal before winter.',             'low',   'in_progress','10000000-0000-0000-0000-000000000003'),
  ('61000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','60000000-0000-0000-0000-000000000102','Aircon servicing overdue','Kitchen unit cooling weakly; book a service.',                 'medium','open',       '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;
