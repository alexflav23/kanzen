-- F15/F16/F17 — seed the pay queue + an approvals queue so the Finance surface is alive.
insert into payment_methods (id, owner_id, type, display_name, last4, currency) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'bank_account', 'Coutts Current', '1234', 'GBP')
on conflict (id) do nothing;

insert into bill_payments (id, bill_id, payment_method_id, due_date, amount_minor, currency, mode, state) values
  ('a1000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', current_date + 20, 14500, 'GBP', 'manual', 'scheduled'),
  ('a1000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', current_date + 8,  22000, 'GBP', 'auto',   'scheduled')
on conflict (id) do nothing;

-- two over-threshold expenses awaiting the Principal's approval
insert into expenses (id, owner_id, payee, amount_minor, currency, status, requested_by) values
  ('a2000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Bonhams appraisal',  180000, 'GBP', 'pending_approval', '10000000-0000-0000-0000-000000000002'),
  ('a2000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Restoration deposit', 250000, 'GBP', 'pending_approval', '10000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;
