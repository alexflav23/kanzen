-- F37 currencies & FX — active currency registry + daily rate snapshots (quote = base GBP).
-- Convention: fx_rates(base, quote, rate) means 1 `base` = `rate` `quote`. We snapshot each
-- foreign currency against GBP (our reporting base); cross pairs triangulate via GBP.
insert into currencies (code, symbol, decimals, active) values
  ('GBP', '£',  2, true),
  ('SGD', 'S$', 2, true),
  ('USD', '$',  2, true),
  ('EUR', '€',  2, true),
  ('CHF', 'Fr', 2, true)
on conflict (code) do nothing;

-- Two dated snapshots per pair so rate-on-date / nearest-prior is exercised.
insert into fx_rates (base, quote, rate, as_of, source) values
  ('USD', 'GBP', 0.79, date '2026-01-01', 'seed'),
  ('USD', 'GBP', 0.80, date '2026-05-01', 'seed'),
  ('SGD', 'GBP', 0.58, date '2026-01-01', 'seed'),
  ('SGD', 'GBP', 0.59, date '2026-05-01', 'seed'),
  ('EUR', 'GBP', 0.85, date '2026-01-01', 'seed'),
  ('CHF', 'GBP', 0.88, date '2026-01-01', 'seed')
on conflict (base, quote, as_of) do nothing;

-- FX/currency are system-fetched, readable by everyone (conversions of actual data inherit
-- the viewer's field-level permissions at the data source — a converted total never leaks).
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'fx', null, 'read'),
  ('manager',   'fx', null, 'read'),
  ('staff',     'fx', null, 'read')
on conflict (role_name, resource, field) do nothing;
