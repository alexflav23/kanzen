-- W4 (F03) — Overview depth: a building-management contact + the property's linked-system references.
-- Linked systems are STORED REFERENCES ONLY (F03 §7): the household's native task project, its Google
-- Calendar id, a Drive folder path and a 1Password vault NAME. Kanzen never holds a secret — the vault
-- field is a name/label for the operator to find, never the credentials themselves.
alter table properties
  add column if not exists building_management text,
  add column if not exists task_project_id     uuid references task_projects (id),
  add column if not exists google_calendar_id   text,
  add column if not exists drive_folder          text,
  add column if not exists onepassword_vault     text;

-- Wardian — Apt 5206 (property ...001): fully linked (task project b0000000…001 = "Wardian — Household").
update properties set
  building_management = 'Ballymore — Wardian Estate Management',
  task_project_id     = 'b0000000-0000-0000-0000-000000000001',
  google_calendar_id  = 'wardian.5206@group.calendar.google.com',
  drive_folder        = 'Kanzen / Properties / Wardian — Apt 5206',
  onepassword_vault   = 'Wardian — Apt 5206'
where id = '20000000-0000-0000-0000-000000000001';

-- Singapore Residence (property ...002): partly linked.
update properties set
  building_management = 'Frasers Property — Estate Office',
  drive_folder        = 'Kanzen / Properties / Singapore Residence',
  onepassword_vault   = 'Singapore Residence'
where id = '20000000-0000-0000-0000-000000000002';
