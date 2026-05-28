-- W5 (F43) — give the Individual book a real P&L so the income statement isn't structurally £0.
-- An income + an expense account, and two balanced current-period postings (each tx sums to 0).
insert into gl_accounts (id, owner_id, entity_id, code, name, type, currency, subkind) values
  ('42000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'fav-income',   'Rental & misc income',   'income',  'GBP', null),
  ('42000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'fav-runcosts', 'Property running costs',  'expense', 'GBP', null)
on conflict (id) do nothing;

insert into gl_transactions (id, owner_id, kind, description, occurred_on) values
  ('43000000-0000-0000-0000-000000000020', '10000000-0000-0000-0000-000000000001', 'income',  'Rental income — this month',          current_date),
  ('43000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'expense', 'Property running costs — this month', current_date)
on conflict (id) do nothing;

-- income £12,000: credit income (−), debit Coutts cash (+).  expense £4,500: debit expense (+), credit cash (−).
insert into gl_splits (transaction_id, account_id, amount_minor, memo) values
  ('43000000-0000-0000-0000-000000000020', '42000000-0000-0000-0000-000000000017', -1200000, 'rental income'),
  ('43000000-0000-0000-0000-000000000020', '42000000-0000-0000-0000-000000000010',  1200000, 'into Coutts'),
  ('43000000-0000-0000-0000-000000000021', '42000000-0000-0000-0000-000000000018',   450000, 'running costs'),
  ('43000000-0000-0000-0000-000000000021', '42000000-0000-0000-0000-000000000010',  -450000, 'from Coutts');
