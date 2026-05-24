-- F05 — document permissions. Managers manage household documents (upload/classify/
-- attach) but never Principal-private ones (enforced by visibility in the service);
-- Staff get scoped read. Principal is covered by '*' admin.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'document', null, 'write'),
  ('staff',   'document', null, 'read')
on conflict (role_name, resource, field) do nothing;
