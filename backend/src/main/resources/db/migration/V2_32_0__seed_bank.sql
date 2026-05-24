-- F12 — finance permissions + a seeded account with transactions. Manager has the
-- operational carve-out (read + import) but the balance field stays denied (V1_2_0).
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'bank_account', null, 'write')
on conflict (role_name, resource, field) do nothing;

insert into financial_accounts (id, owner_id, name, currency, kind) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Coutts Current', 'GBP', 'current')
on conflict (id) do nothing;

insert into bank_transactions (account_id, provider_tx_id, booked_on, amount_minor, currency, direction, description, merchant) values
  ('80000000-0000-0000-0000-000000000001', 'seed-1', current_date - 5, 184000, 'GBP', 'debit',  'Hudson Sandler Ltd', 'Hudson Sandler'),
  ('80000000-0000-0000-0000-000000000001', 'seed-2', current_date - 3,   4250, 'GBP', 'debit',  'Waitrose',           'Waitrose'),
  ('80000000-0000-0000-0000-000000000001', 'seed-3', current_date - 1,   5000, 'GBP', 'credit', 'Refund',             null)
on conflict (account_id, provider_tx_id) do nothing;
