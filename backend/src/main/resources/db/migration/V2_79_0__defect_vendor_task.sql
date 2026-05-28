-- W4 (F03) — defect ops: assign a vendor (F09) to a defect and link the task (F06) spawned to fix it.
alter table defects
  add column if not exists assigned_vendor_id uuid references vendors (id),
  add column if not exists task_id            uuid references tasks (id);

-- demo parity: the dishwasher defect is assigned to Thames Plumbing (the approved, insured plumber).
update defects set assigned_vendor_id = '60000000-0000-0000-0000-000000000001'
where id = '61000000-0000-0000-0000-000000000001';
