-- F06 tasks (specs/F06). Native task domain (no Todoist).
create table task_projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  name        text not null,
  property_id uuid references properties(id),
  created_at  timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  project_id   uuid references task_projects(id),
  title        text not null,
  assignee_id  uuid,
  status       text not null default 'todo',  -- todo|in_progress|done|cancelled
  due_on       date,
  recurrence   text,                          -- daily|weekly|monthly (RRULE later)
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
