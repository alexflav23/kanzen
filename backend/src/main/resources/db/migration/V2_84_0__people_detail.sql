-- F10 (W7.1) — person detail fields: contract + key dates, work-permit number, emergency
-- contacts, payroll reference (external bureau — reference only, no payroll engine), notes.
alter table employment_records add column if not exists contract_type     text;
alter table employment_records add column if not exists start_date        date;
alter table employment_records add column if not exists end_date          date;
alter table employment_records add column if not exists work_permit_no     text;
alter table employment_records add column if not exists emergency_contacts jsonb not null default '[]';
alter table employment_records add column if not exists payroll_ref        text;
alter table employment_records add column if not exists notes              text;

-- enrich the seeded team so the detail page has real depth.
update employment_records set contract_type = 'Full-time', start_date = '2019-03-01', payroll_ref = 'COUTTS-PR-019',
  emergency_contacts = '[{"name":"James Bridge","relation":"Spouse","phone":"+44 7700 900118"}]',
  notes = 'Chief of staff — runs HR and operations across both properties.'
  where id = '50000000-0000-0000-0000-000000000002';

update employment_records set contract_type = 'Full-time', start_date = '2021-06-14', payroll_ref = 'COUTTS-PR-044',
  emergency_contacts = '[{"name":"Paulo Coomber","relation":"Spouse","phone":"+44 7700 900145"}]',
  notes = 'Housekeeper at Wardian. Right-to-work verified (UK).'
  where id = '50000000-0000-0000-0000-000000000003';

update employment_records set contract_type = 'Full-time', start_date = '2022-09-05', work_permit_no = 'S1234567X', payroll_ref = 'DBS-PR-051',
  emergency_contacts = '[{"name":"Ahmad Rahmat","relation":"Brother","phone":"+65 8123 4567"}]',
  notes = 'Housekeeper at Singapore. MOM Work Permit — renewal tracked via permit expiry.'
  where id = '50000000-0000-0000-0000-000000000004';
