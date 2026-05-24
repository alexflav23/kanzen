-- F19 — seed an acquisition event for the Royal Oak so the lifecycle timeline is non-empty.
insert into asset_events (id, owner_id, asset_id, type, cost_minor, currency, note) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000001', 'acquired', 3500000, 'GBP', 'Purchased from authorised dealer')
on conflict (id) do nothing;
