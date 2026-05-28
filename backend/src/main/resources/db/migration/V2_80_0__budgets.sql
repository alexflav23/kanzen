-- W5 (F17) — per-property/category budgets. Budget-vs-actual is computed against APPROVED expenses in the
-- period window (monthly/quarterly/annually) matching the budget's scope; no FX (same-currency only).
create table budgets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  property_id  uuid references properties (id),
  category_id  uuid references categories (id),
  period       text   not null default 'monthly',   -- monthly|quarterly|annually
  amount_minor bigint not null,
  currency     text   not null,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Two Wardian budgets (a monthly operating budget + an annual cap).
insert into budgets (id, owner_id, property_id, period, amount_minor, currency) values
  ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'monthly',  200000, 'GBP'),
  ('c0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'annually', 5000000, 'GBP')
on conflict (id) do nothing;

-- A few approved Wardian expenses this month so budget-vs-actual shows a real bar (£650 of the £2,000 monthly).
insert into expenses (id, owner_id, property_id, payee, amount_minor, currency, incurred_on, status) values
  ('a2000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Cleaning — monthly', 45000, 'GBP', current_date, 'approved'),
  ('a2000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Window cleaning',     8000, 'GBP', current_date, 'approved'),
  ('a2000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Gardening service',  12000, 'GBP', current_date, 'approved')
on conflict (id) do nothing;
