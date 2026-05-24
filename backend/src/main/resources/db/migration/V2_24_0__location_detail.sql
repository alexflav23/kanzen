-- F03 — richer location nodes for the Bible's room tree (floor/area/notes + updated_at).
alter table locations
  add column floor      text,
  add column area       text,
  add column notes      text,
  add column updated_at timestamptz not null default now();
