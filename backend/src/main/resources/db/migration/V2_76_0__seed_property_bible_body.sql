-- W4 (F03) — give the Property Bible's Assets + Documents tabs a real body.
-- (a) Place the seeded household items into Wardian rooms so `?property=` (which resolves an asset's
--     property via its current location) returns them — both here and on the Inventory Property facet.
-- (b) File a few documents against the property: operational papers a Manager may handle (household)
--     plus the Title Register, which is Principal-private — exercising the visibility carve-out.

-- (a) current location_id ← Wardian rooms (property ...001). Idempotent: only sets unplaced assets.
update assets set location_id = '60000000-0000-0000-0000-000000000009' where id = '40000000-0000-0000-0000-000000000001' and location_id is null; -- Royal Oak  → Walk-in Wardrobe (safe)
update assets set location_id = '60000000-0000-0000-0000-000000000009' where id = '40000000-0000-0000-0000-000000000002' and location_id is null; -- Submariner → Walk-in Wardrobe (safe)
update assets set location_id = '60000000-0000-0000-0000-000000000005' where id = '40000000-0000-0000-0000-000000000003' and location_id is null; -- Les Paul   → Study
update assets set location_id = '60000000-0000-0000-0000-000000000001' where id = '40000000-0000-0000-0000-000000000004' and location_id is null; -- Richter    → Living Room
update assets set location_id = '60000000-0000-0000-0000-000000000008' where id = '40000000-0000-0000-0000-000000000005' and location_id is null; -- Tumblers   → Kitchen Pantry

-- (b) property documents (owner = Toby ...001). s3_key is a placeholder reference (no blob fetched here).
insert into documents (id, owner_id, name, category, content_type, size_bytes, s3_key, sha256, visibility, source, property_id, immutable) values
  ('d1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','EPC Certificate.pdf',            'certificate','application/pdf', 248000,'seed/wardian/epc.pdf',       null,'household',         'manual','20000000-0000-0000-0000-000000000001', true),
  ('d1000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Buildings Insurance 2026.pdf',   'insurance',  'application/pdf', 612000,'seed/wardian/insurance.pdf', null,'household',         'manual','20000000-0000-0000-0000-000000000001', true),
  ('d1000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Title Register — Apt 5206.pdf',  'legal',      'application/pdf', 184000,'seed/wardian/title.pdf',     null,'principal_private', 'manual','20000000-0000-0000-0000-000000000001', true),
  ('d1000000-0000-0000-0000-000000000101','10000000-0000-0000-0000-000000000001','Tenancy Agreement — Singapore.pdf','legal',    'application/pdf', 330000,'seed/sg/tenancy.pdf',        null,'household',         'manual','20000000-0000-0000-0000-000000000002', true)
on conflict (id) do nothing;
