-- F06 — tasks are operational: Manager manages, Staff already write (V1_2_0), Principal '*'.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'task', null, 'write')
on conflict (role_name, resource, field) do nothing;

-- a household task project + a couple of tasks (one recurring).
insert into task_projects (id, owner_id, name, property_id) values
  ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Wardian — Household', '20000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into tasks (id, owner_id, project_id, title, status, due_on, recurrence) values
  ('b1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Water the plants', 'todo', current_date + 1, 'weekly'),
  ('b1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Service the boiler', 'todo', current_date + 14, null)
on conflict (id) do nothing;
