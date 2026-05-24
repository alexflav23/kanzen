-- F07 demo seed — two native calendar events dated relative to today (so the agenda always
-- renders regardless of when the app runs). Joins the merged view alongside the task &
-- maintenance overlays. No audit rows written (MigrationsIT stays clean).
insert into calendar_event_refs (id, owner_id, title, start_on, category, source) values
  ('48000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Plumber visit · Wardian',   current_date + 2, 'maintenance', 'manual'),
  ('48000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Waitrose delivery',         current_date + 5, 'delivery',    'manual')
on conflict (id) do nothing;
