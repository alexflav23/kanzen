-- F06 — associate a task with what it's about: a property and/or one or more assets (e.g. a task about a
-- specific piece of furniture links to that asset). Polymorphic link rows, mirroring document_links.
create table if not exists task_links (
  task_id     uuid not null references tasks(id) on delete cascade,
  target_type text not null,            -- asset | property
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (task_id, target_type, target_id)
);
create index if not exists task_links_target_idx on task_links (target_type, target_id);

-- F10 — a person can have a profile photo (an F05 image document, set hero-style); rendered as their round avatar.
alter table employment_records add column if not exists photo_document_id uuid;

-- A task that's about a specific asset (the "piece of furniture / artwork" case the registry is built for):
-- arrange a valuation for the Richter painting (asset …004), assigned to the House Manager.
insert into tasks (id, owner_id, project_id, title, status, due_on, recurrence, priority, assignee_id) values
  ('b1000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003',
   'Arrange a fresh valuation for the Richter', 'todo', current_date + 9, null, 'normal', '50000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

-- Seed links so the feature shows real data, against real rows: tasks → their property or asset.
insert into task_links (task_id, target_type, target_id) values
  ('b1000000-0000-0000-0000-000000000002', 'property', '20000000-0000-0000-0000-000000000001'),   -- Service the boiler → Wardian
  ('b1000000-0000-0000-0000-000000000015', 'property', '20000000-0000-0000-0000-000000000001'),   -- Deep-clean the kitchen → Wardian
  ('b1000000-0000-0000-0000-000000000018', 'asset',    '40000000-0000-0000-0000-000000000004')    -- valuation → Richter (asset)
on conflict do nothing;
