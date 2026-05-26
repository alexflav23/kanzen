-- Wave G — a realistic Private-Wealth book so Net worth / Investments / Balance sheet read like a
-- UHNWI household rather than a £6k demo. Double-entry: every transaction's splits sum to zero, so
-- the balance sheet stays balanced. GL tracks cash/property/mortgage/equity; investments are tracked
-- as cost-basis lots (priced separately) and add to net worth on top of the GL assets.
-- Owner = Toby (...001). Entities: Flavian Individual (...001), Wardian Family Trust (...002).

-- ── GL accounts ────────────────────────────────────────────────────────────
insert into gl_accounts (id, owner_id, entity_id, code, name, type, currency, subkind) values
  ('42000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','fav-coutts',   'Coutts premier',         'asset',     'GBP', 'cash'),
  ('42000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','fav-property', 'Wardian — Apt 5206',     'asset',     'GBP', 'property'),
  ('42000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','fav-mortgage', 'Wardian mortgage',       'liability', 'GBP', 'loan'),
  ('42000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','fav-equity2',  'Opening equity',         'equity',    'GBP', null),
  ('42000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','trust-cash',   'Trust reserve (DBS)',    'asset',     'GBP', 'cash'),
  ('42000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','trust-property','Singapore Residence',   'asset',     'GBP', 'property'),
  ('42000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','trust-equity', 'Settled capital',        'equity',    'GBP', null)
on conflict (id) do nothing;

-- ── balanced opening positions ──────────────────────────────────────────────
insert into gl_transactions (id, owner_id, kind, description, occurred_on) values
  ('43000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','opening_balance','Individual opening position', date '2026-01-01'),
  ('43000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','opening_balance','Family Trust opening position', date '2026-01-01')
on conflict (id) do nothing;

-- Flavian (Individual): cash £850k + Wardian £2.4m − mortgage £1.2m = equity £2.05m  (sum = 0)
insert into gl_splits (transaction_id, account_id, amount_minor, memo) values
  ('43000000-0000-0000-0000-000000000010','42000000-0000-0000-0000-000000000010',   85000000, 'Coutts cash'),
  ('43000000-0000-0000-0000-000000000010','42000000-0000-0000-0000-000000000011',  240000000, 'Wardian apartment at value'),
  ('43000000-0000-0000-0000-000000000010','42000000-0000-0000-0000-000000000012', -120000000, 'Wardian mortgage outstanding'),
  ('43000000-0000-0000-0000-000000000010','42000000-0000-0000-0000-000000000013', -205000000, 'Individual equity'),
-- Wardian Family Trust: cash £450k + Singapore £3.8m = equity £4.25m  (sum = 0)
  ('43000000-0000-0000-0000-000000000011','42000000-0000-0000-0000-000000000014',   45000000, 'Trust cash reserve'),
  ('43000000-0000-0000-0000-000000000011','42000000-0000-0000-0000-000000000015',  380000000, 'Singapore residence at value'),
  ('43000000-0000-0000-0000-000000000011','42000000-0000-0000-0000-000000000016', -425000000, 'Settled capital')
on conflict do nothing;

-- ── a diversified portfolio (Individual entity) ──────────────────────────────
insert into securities (id, symbol, name, currency, asset_class) values
  ('41000000-0000-0000-0000-000000000002','IUSA','iShares Core S&P 500',        'GBP', 'fund'),
  ('41000000-0000-0000-0000-000000000003','IGLN','iShares Physical Gold',       'GBP', 'commodity'),
  ('41000000-0000-0000-0000-000000000004','VGOV','Vanguard UK Gilt',            'GBP', 'bond')
on conflict (id) do nothing;

insert into security_prices (security_id, price_minor, as_of, source) values
  ('41000000-0000-0000-0000-000000000002', 4200, date '2026-05-01', 'seed'),
  ('41000000-0000-0000-0000-000000000003', 3850, date '2026-05-01', 'seed'),
  ('41000000-0000-0000-0000-000000000004', 1820, date '2026-05-01', 'seed')
on conflict (security_id, as_of) do nothing;

insert into investment_lots (id, owner_id, entity_id, security_id, quantity, cost_basis_minor, acquired_on) values
  ('44000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001', 2000, 19000000, date '2025-09-10'), -- more VWRL
  ('44000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000002',  800,  3000000, date '2025-11-02'), -- IUSA
  ('44000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000003', 1500,  5200000, date '2025-06-18'), -- IGLN
  ('44000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000004', 4000,  8000000, date '2026-01-20')  -- VGOV
on conflict (id) do nothing;
