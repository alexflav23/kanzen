-- Wave G demo seed — give the Toby (Individual) entity a small book so the Wealth web surface
-- renders real figures: an opening cash balance (double-entry) + a VWRL holding (priced in V2_50).
-- (WealthApiIT/AuthzFuzzIT scope to their own freshly-created entities, so this seed can't affect
-- them; no audit rows are written, so MigrationsIT stays clean.)
insert into gl_accounts (id, owner_id, entity_id, code, name, type, currency) values
  ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'toby-cash',   'Coutts current',  'asset',  'GBP'),
  ('42000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'toby-equity', 'Opening equity',  'equity', 'GBP')
on conflict (id) do nothing;

insert into gl_transactions (id, owner_id, kind, description, occurred_on) values
  ('43000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'opening_balance', 'Opening balance', date '2026-01-01')
on conflict (id) do nothing;

-- balanced: debit cash +£5,000.00 / credit equity −£5,000.00
insert into gl_splits (transaction_id, account_id, amount_minor, memo) values
  ('43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001',  500000, 'opening cash'),
  ('43000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000002', -500000, 'opening equity')
on conflict do nothing;

-- a VWRL lot for the Individual entity: 10 units, £900 cost; priced at £98/unit → £980 market.
insert into investment_lots (id, owner_id, entity_id, security_id, quantity, cost_basis_minor, acquired_on) values
  ('44000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 10, 90000, date '2026-02-15')
on conflict (id) do nothing;
