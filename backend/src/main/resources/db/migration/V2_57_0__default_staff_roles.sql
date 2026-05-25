-- F02 — preloaded default household-staff roles.
--
-- These are SEEDED, never hardcoded: each is an ordinary editable/deletable row (is_system = false),
-- and the Authorizer reads `permission_rules` at runtime — so an admin can retune or remove any of
-- them from Settings, or create entirely new ones, on the fly. Only the Principal (owner) stays the
-- protected superuser. Field-level rules keep prices/valuations off non-owner roles (the §16 carve-out).

insert into roles (name, description, is_system) values
  ('Personal Assistant',  'Runs day-to-day household ops; no finance or valuations',          false),
  ('Executive Assistant', 'Senior PA + operational finance visibility; no ledger/valuations',  false),
  ('Housekeeper',         'On-site: own tasks, raise maintenance; never sees prices',          false),
  ('Gardener',            'Grounds: tasks + maintenance only',                                 false)
on conflict (name) do nothing;

insert into permission_rules (role_name, resource, field, level) values
  -- Personal Assistant — broad operations, sees assets but not their value, no money
  ('Personal Assistant', 'task',         null,            'write'),
  ('Personal Assistant', 'list',         null,            'write'),
  ('Personal Assistant', 'calendar',     null,            'write'),
  ('Personal Assistant', 'maintenance',  null,            'write'),
  ('Personal Assistant', 'notification', null,            'write'),
  ('Personal Assistant', 'person',       null,            'read'),
  ('Personal Assistant', 'vendor',       null,            'read'),
  ('Personal Assistant', 'property',     null,            'read'),
  ('Personal Assistant', 'document',     null,            'read'),
  ('Personal Assistant', 'search',       null,            'read'),
  ('Personal Assistant', 'asset',        null,            'read'),
  ('Personal Assistant', 'asset',        'market_value',  'none'),
  ('Personal Assistant', 'asset',        'insured_value', 'none'),
  -- Executive Assistant — PA plus vendor/document write and operational finance visibility (read-only)
  ('Executive Assistant', 'task',         null,            'write'),
  ('Executive Assistant', 'list',         null,            'write'),
  ('Executive Assistant', 'calendar',     null,            'write'),
  ('Executive Assistant', 'maintenance',  null,            'write'),
  ('Executive Assistant', 'notification', null,            'write'),
  ('Executive Assistant', 'person',       null,            'read'),
  ('Executive Assistant', 'property',     null,            'read'),
  ('Executive Assistant', 'search',       null,            'read'),
  ('Executive Assistant', 'vendor',       null,            'write'),
  ('Executive Assistant', 'document',     null,            'write'),
  ('Executive Assistant', 'asset',        null,            'write'),
  ('Executive Assistant', 'asset',        'market_value',  'none'),
  ('Executive Assistant', 'asset',        'insured_value', 'none'),
  ('Executive Assistant', 'bill',         null,            'read'),
  ('Executive Assistant', 'expense',      null,            'read'),
  -- Housekeeper — own tasks, raise maintenance, read property/assets; never prices
  ('Housekeeper', 'task',        null,               'write'),
  ('Housekeeper', 'list',        null,               'read'),
  ('Housekeeper', 'maintenance', null,               'write'),
  ('Housekeeper', 'property',    null,               'read'),
  ('Housekeeper', 'asset',       null,               'read'),
  ('Housekeeper', 'asset',       'market_value',     'none'),
  ('Housekeeper', 'asset',       'insured_value',    'none'),
  ('Housekeeper', 'asset',       'acquisition_cost', 'none'),
  -- Gardener — grounds only
  ('Gardener', 'task',        null, 'write'),
  ('Gardener', 'maintenance', null, 'write'),
  ('Gardener', 'property',    null, 'read')
on conflict (role_name, resource, field) do nothing;
