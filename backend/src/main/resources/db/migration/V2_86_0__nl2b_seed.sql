-- NL-2b — make the three crisp natural-language questions answer against real data:
--   "when is my car next due a service"        → a service plan linked to the Range Rover (asset, not just property)
--   "how much is my car insurance"             → an asset_insurance cover record on the Range Rover
--   "when was the housekeeper last in"          → past Housekeeping bookings on the calendar
-- All scoped to Toby (principal) + the Wardian; relative dates so the answers stay live.

-- A vehicle *service* plan (the first asset-linked maintenance plan — others are property-level).
insert into maintenance_plans
  (id, owner_id, title, property_id, asset_id, vendor, frequency, next_due, lead_days, expected_cost_minor, currency)
values
  ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   'Annual service', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006',
   'Stratstone Land Rover', 'annually', current_date + 47, 14, 95000, 'GBP')
on conflict (id) do nothing;

-- Insurance *cover* on the Range Rover (sum insured + insurer + renewal — Kanzen stores cover, not premiums).
insert into asset_insurance (id, asset_id, insured, policy_ref, insurer, insured_value_minor, renewal_on)
values
  ('c1000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000006',
   true, 'HX-RR-2024-8841', 'Hiscox', 12500000, current_date + 26)
on conflict (id) do nothing;

-- Past Housekeeping bookings so "when was the housekeeper last in" has real history (the today + future
-- bookings already exist in the calendar seed; these add the recent past).
insert into calendar_event_refs (id, owner_id, title, start_on, category, source) values
  ('48000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'Housekeeping · Wardian', current_date - 2, 'booking', 'manual'),
  ('48000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Housekeeping · Wardian', current_date - 9, 'booking', 'manual')
on conflict (id) do nothing;
