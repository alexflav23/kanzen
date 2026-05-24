-- F03 defects — richer fields + lifecycle, and the raise/transition permission split.
alter table defects
  add column description text,
  add column updated_at  timestamptz not null default now(),
  add column deleted_at  timestamptz;

-- Managers manage defects fully; Staff may RAISE (write) but not transition status
-- (field-level deny on defect.status) — F03 AC5/AC6. Principal is covered by '*' admin.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'defect', null,     'write'),
  ('staff',   'defect', null,     'write'),
  ('staff',   'defect', 'status', 'none')
on conflict (role_name, resource, field) do nothing;
