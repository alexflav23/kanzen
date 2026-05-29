-- F07 (W6.5) — timed events for the day/week hour-grid. Times are PROPERTY-LOCAL WALL-CLOCK
-- (no zone, no conversion): "09:30 at Wardian" is 09:30 on Wardian's calendar. NULL = all-day.
alter table calendar_event_refs add column if not exists start_time time;
alter table calendar_event_refs add column if not exists end_time   time;

-- give the two existing seeded events times…
update calendar_event_refs set start_time = '09:30', end_time = '11:00' where id = '48000000-0000-0000-0000-000000000001';
update calendar_event_refs set start_time = '14:00', end_time = '14:30' where id = '48000000-0000-0000-0000-000000000002';

-- …and add a few near today so the Day/Week grid (centred on today) shows timed blocks.
insert into calendar_event_refs (id, owner_id, title, start_on, start_time, end_time, category, source) values
  ('48000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Housekeeping · Wardian', current_date,     '08:00', '10:00', 'booking', 'manual'),
  ('48000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Personal trainer',       current_date,     '18:00', '19:00', 'booking', 'manual'),
  ('48000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Dentist · Lorna',        current_date + 1, '10:30', '11:15', 'booking', 'manual')
on conflict (id) do nothing;
