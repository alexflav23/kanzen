-- F02 — the deeper estate-staff roster (a large household à la a full-service estate).
--
-- Same principle as V2_57: SEEDED defaults, never hardcoded — every one is an editable/deletable
-- non-system row, the Authorizer reads permission_rules at runtime, and an admin can retune, rename
-- or remove any of them (or add more — Pool Tech, Valet, Laundress, Personal Trainer — from Settings).
-- Field-level rules keep prices/valuations off every non-owner role (the §16 carve-out); childcare
-- (Nanny) is deliberately the narrowest, privacy-first set.

insert into roles (name, description, is_system) values
  ('Estate Manager',  'Senior on-site lead: runs the property, staff, vendors + maintenance',  false),
  ('Chef',            'Kitchen: provisioning lists + grocery spend visibility',                false),
  ('Butler',          'Front of house / service: schedule, lists, guests',                     false),
  ('Nanny',           'Childcare: tasks + family calendar only (privacy-first, no finance)',    false),
  ('Chauffeur',       'Transport: schedule + vehicle upkeep',                                   false),
  ('Head of Security','Estate security: access, patrols, incident logging',                     false)
on conflict (name) do nothing;

insert into permission_rules (role_name, resource, field, level) values
  -- Estate Manager — the senior operational role (property/staff/vendors), finance read-only, no valuations
  ('Estate Manager', 'property',     null,            'write'),
  ('Estate Manager', 'maintenance',  null,            'write'),
  ('Estate Manager', 'vendor',       null,            'write'),
  ('Estate Manager', 'task',         null,            'write'),
  ('Estate Manager', 'list',         null,            'write'),
  ('Estate Manager', 'calendar',     null,            'write'),
  ('Estate Manager', 'document',     null,            'write'),
  ('Estate Manager', 'notification', null,            'write'),
  ('Estate Manager', 'person',       null,            'read'),
  ('Estate Manager', 'bill',         null,            'read'),
  ('Estate Manager', 'expense',      null,            'read'),
  ('Estate Manager', 'asset',        null,            'read'),
  ('Estate Manager', 'asset',        'market_value',  'none'),
  ('Estate Manager', 'asset',        'insured_value', 'none'),
  -- Chef — provisioning + kitchen spend visibility
  ('Chef', 'list',         null, 'write'),
  ('Chef', 'task',         null, 'write'),
  ('Chef', 'calendar',     null, 'read'),
  ('Chef', 'vendor',       null, 'read'),
  ('Chef', 'bill',         null, 'read'),
  ('Chef', 'expense',      null, 'read'),
  ('Chef', 'notification', null, 'read'),
  -- Butler — front of house / service
  ('Butler', 'task',         null, 'write'),
  ('Butler', 'calendar',     null, 'write'),
  ('Butler', 'list',         null, 'read'),
  ('Butler', 'person',       null, 'read'),
  ('Butler', 'vendor',       null, 'read'),
  ('Butler', 'document',     null, 'read'),
  ('Butler', 'notification', null, 'read'),
  -- Nanny — childcare; deliberately the narrowest, privacy-first set (no finance, assets, documents)
  ('Nanny', 'task',         null, 'write'),
  ('Nanny', 'calendar',     null, 'write'),
  ('Nanny', 'list',         null, 'read'),
  ('Nanny', 'person',       null, 'read'),
  ('Nanny', 'notification', null, 'read'),
  -- Chauffeur — schedule + vehicle/maintenance upkeep
  ('Chauffeur', 'task',         null, 'write'),
  ('Chauffeur', 'calendar',     null, 'read'),
  ('Chauffeur', 'maintenance',  null, 'write'),
  ('Chauffeur', 'property',     null, 'read'),
  ('Chauffeur', 'notification', null, 'read'),
  -- Head of Security — access, patrols, incident logging
  ('Head of Security', 'task',         null, 'write'),
  ('Head of Security', 'property',     null, 'read'),
  ('Head of Security', 'maintenance',  null, 'write'),
  ('Head of Security', 'document',     null, 'read'),
  ('Head of Security', 'person',       null, 'read'),
  ('Head of Security', 'notification', null, 'write')
on conflict (role_name, resource, field) do nothing;
