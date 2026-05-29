-- F06 — give Tasks realistic depth: a couple more projects + a spread of household tasks across priorities,
-- due-date buckets (overdue / today / this week / later / no date), assignees and recurrence, so the Todoist-grade
-- view has something true to show. Dates are relative to current_date so the buckets stay live.

insert into task_projects (id, owner_id, name, property_id) values
  ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Singapore — Household', '20000000-0000-0000-0000-000000000002'),
  ('b0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Finance & admin', '20000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- assign the two original seed tasks to the Wardian housekeeper
update tasks set assignee_id = '50000000-0000-0000-0000-000000000003'
  where id in ('b1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000002');

insert into tasks (id, owner_id, project_id, title, status, due_on, recurrence, priority, assignee_id) values
  -- overdue (Lorna, House Manager)
  ('b1000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Chase the window-cleaner invoice', 'todo', current_date - 2, null, 'high', '50000000-0000-0000-0000-000000000002'),
  -- today (urgent access task for Marcia; a low-priority errand)
  ('b1000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Be in for the HVAC service (access)', 'todo', current_date, null, 'urgent', '50000000-0000-0000-0000-000000000003'),
  ('b1000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Order more coffee pods', 'todo', current_date, null, 'low', '50000000-0000-0000-0000-000000000003'),
  -- this week
  ('b1000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Renew the TV licence', 'todo', current_date + 5, 'quarterly', 'high', '50000000-0000-0000-0000-000000000002'),
  ('b1000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'Pool filter service — be present', 'todo', current_date + 4, null, 'normal', '50000000-0000-0000-0000-000000000004'),
  ('b1000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Deep-clean the kitchen', 'todo', current_date + 3, 'fortnightly', 'normal', '50000000-0000-0000-0000-000000000003'),
  -- later
  ('b1000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'Review Q2 maintenance variance', 'todo', current_date + 20, null, 'normal', '50000000-0000-0000-0000-000000000002'),
  -- no date (someday)
  ('b1000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Find a piano tuner for the Steinway', 'todo', null, null, 'low', '50000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;
