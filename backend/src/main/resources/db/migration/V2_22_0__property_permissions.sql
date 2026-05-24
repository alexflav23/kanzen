-- F02/F03 — properties are operational context, not Principal-private registry/finance.
-- Everyone who works in the household can see them; managers operate on them. The
-- Principal is already covered by the ('principal','*',admin) wildcard rule.
insert into permission_rules (role_name, resource, field, level) values
  ('manager',                 'property', null, 'write'),
  ('property_scoped_manager', 'property', null, 'write'),
  ('staff',                   'property', null, 'read'),
  ('maintenance',             'property', null, 'read')
on conflict (role_name, resource, field) do nothing;
