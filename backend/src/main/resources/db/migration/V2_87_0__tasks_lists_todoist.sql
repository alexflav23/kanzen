-- Tasks (F06) & Lists (F08) → "Todoist-grade": a priority on both, and a run-level assignee on lists.
-- Priority: urgent | high | normal | low (default normal). Recurrence/cadence gains fortnightly/quarterly in code.
-- List assignee_id is a person (employment_records.id) — the same id space the web assignee picker uses for tasks.

alter table tasks          add column if not exists priority    text not null default 'normal';
alter table shopping_lists add column if not exists priority    text not null default 'normal';
alter table shopping_lists add column if not exists assignee_id uuid;

-- Seed so it's live & realistic: give each grocery/supplies run to the on-site Housekeeper of its property
-- (falling back to any Housekeeper), and bump a couple of obviously-urgent tasks.
update shopping_lists sl set assignee_id = coalesce(
  (select er.id from employment_records er
   where er.role ilike '%housekeeper%' and er.property_id = sl.property_id and er.deleted_at is null
   order by er.created_at limit 1),
  (select er.id from employment_records er
   where er.role ilike '%housekeeper%' and er.deleted_at is null order by er.created_at limit 1))
where sl.deleted_at is null and sl.type in ('grocery', 'supplies');

update tasks set priority = 'high'
where (lower(title) like '%fix%' or lower(title) like '%repair%' or lower(title) like '%plumb%'
       or lower(title) like '%leak%' or lower(title) like '%boiler%' or lower(title) like '%safety%'
       or lower(title) like '%broken%') and status <> 'done';
