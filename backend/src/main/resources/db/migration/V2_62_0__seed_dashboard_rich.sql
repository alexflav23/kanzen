-- F29 — give the Dashboard real, non-empty panels: a couple of expenses genuinely awaiting
-- approval, and staff review dates so "Expiring within 60 days" shows more than one row.
-- (Upcoming events, lists and properties already have real seeded data.)

insert into expenses (id, owner_id, property_id, payee, description, amount_minor, currency, incurred_on, status, requested_by, deductible, vat_reclaimable) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
   'Climatec Services', 'HVAC quarterly service — Wardian', 184000, 'GBP', current_date - 2, 'pending_approval',
   '10000000-0000-0000-0000-000000000003', true, true),
  ('e0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
   'Lim & Sons Contractors', 'Roof tile repair — Singapore', 264000, 'SGD', current_date - 1, 'pending_approval',
   '10000000-0000-0000-0000-000000000003', true, false)
on conflict (id) do nothing;

-- Staff review cycles (Siti already carries a work-permit expiry from the people seed).
update employment_records set review_due = current_date + 24  where id = '50000000-0000-0000-0000-000000000002'; -- Lorna
update employment_records set review_due = current_date + 41  where id = '50000000-0000-0000-0000-000000000003'; -- Marcia
