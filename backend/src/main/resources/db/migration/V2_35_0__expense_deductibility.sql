-- F17/F38 — expenses gain deductibility + VAT-reclaimable + tax-category flags
-- (ported from the marvis tax layer; estimation-only, Kanzen never files/pays).
alter table expenses
  add column deductible      boolean not null default false,
  add column vat_reclaimable boolean not null default false,
  add column tax_category    text;

-- Manager runs expense ops (create/approve under threshold); over-threshold routes to
-- the Principal (enforced in the service). Staff none; Principal via '*'.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'expense', null, 'write')
on conflict (role_name, resource, field) do nothing;
