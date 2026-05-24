-- F07 calendar — native event authoring + property scope + soft delete. Google two-way sync
-- (watch channels, syncToken, etag conflict resolution) is an external adapter, deferred to
-- hardening with the Gmail/Bedrock Google service account; the idempotent google_event_id
-- upsert (V2_19) is the sync seam. Native events have no google_event_id until pushed.
alter table calendar_event_refs add column if not exists property_id uuid references properties(id);
alter table calendar_event_refs add column if not exists deleted_at  timestamptz;

-- F07 §2 — Principal/Manager author events; Staff read their property's calendar.
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'calendar', null, 'write'),
  ('manager',   'calendar', null, 'write'),
  ('staff',     'calendar', null, 'read')
on conflict (role_name, resource, field) do nothing;
