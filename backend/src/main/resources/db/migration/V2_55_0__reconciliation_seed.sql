-- F14 demo seed — two receipts whose totals + merchants match seeded Coutts transactions
-- (V2_32: Hudson Sandler £1,840.00, Waitrose £42.50), so auto-suggested reconciliations have
-- real candidates to rank. (ReconciliationApiIT scopes to its own inserted rows; no audit rows.)
insert into receipts (id, owner_id, kind, merchant, total_minor, currency, status) values
  ('4a000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'invoice', 'Hudson Sandler', 184000, 'GBP', 'parsed'),
  ('4a000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'receipt', 'Waitrose',       4250,   'GBP', 'parsed')
on conflict (id) do nothing;
