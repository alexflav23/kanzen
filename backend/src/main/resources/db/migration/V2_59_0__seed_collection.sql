-- F04 — a sample asset collection so the Collections surface isn't empty out of the box.
-- "Watches" groups the two seeded watches (Royal Oak + Submariner). Editable/removable like any.
insert into collections (id, owner_id, name, description) values
  ('43000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Watches', 'The everyday + dress watch rotation')
on conflict (id) do nothing;

insert into collection_members (collection_id, asset_id) values
  ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
  ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002')
on conflict do nothing;
