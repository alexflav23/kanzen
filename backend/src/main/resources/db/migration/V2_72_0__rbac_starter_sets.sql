-- F02 v2 (S5) — canonical starter permission sets: reusable, system-owned bundles the household/estate
-- actually needs, built from the action catalogue. ADDITIVE + non-breaking: these sets are NOT attached to
-- any role or team, so every user still resolves to exactly today's permissions (the legacy matrix + bridge
-- remain the source of truth). They are building blocks an admin composes into roles/teams via the builder.
-- is_system = true → protected from deletion (like system roles).

insert into permission_sets (id, name, description, is_system) values
  ('49000000-0000-0000-0000-000000000001', 'Registry — read only',          'View assets, their timelines and documents (no edits, no valuations).', true),
  ('49000000-0000-0000-0000-000000000002', 'Registry — curator',            'Create + maintain assets: edit, move, custody, hero photo, log events, manage documents.', true),
  ('49000000-0000-0000-0000-000000000003', 'Finance — bill approver',       'Review, approve and mark bills paid; approve expenses.', true),
  ('49000000-0000-0000-0000-000000000004', 'Operations — lists & calendar', 'Run shopping lists (propose/approve/order), tasks and the calendar.', true),
  ('49000000-0000-0000-0000-000000000005', 'Property — caretaker',          'View properties, raise + manage defects, run maintenance plans.', true)
on conflict (name) do nothing;

insert into permission_set_grants (set_id, resource, action, field, scope, effect) values
  -- Registry — read only
  ('49000000-0000-0000-0000-000000000001', 'asset',       'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000001', 'asset_event', 'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000001', 'document',    'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000001', 'document',    'download', '', 'all', 'allow'),
  -- Registry — curator
  ('49000000-0000-0000-0000-000000000002', 'asset',       'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset',       'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset',       'edit',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset',       'move',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset',       'custody',  '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset',       'set_hero', '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset_event', 'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'asset_event', 'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'document',    'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'document',    'upload',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'document',    'download', '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000002', 'document',    'edit',     '', 'all', 'allow'),
  -- Finance — bill approver
  ('49000000-0000-0000-0000-000000000003', 'bill',        'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000003', 'bill',        'approve',  '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000003', 'bill',        'pay',      '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000003', 'expense',     'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000003', 'expense',     'approve',  '', 'all', 'allow'),
  -- Operations — lists & calendar
  ('49000000-0000-0000-0000-000000000004', 'list',        'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'list',        'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'list',        'edit',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'list',        'approve',  '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'list',        'order',    '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'task',        'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'task',        'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'task',        'edit',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'calendar',    'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'calendar',    'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000004', 'calendar',    'edit',     '', 'all', 'allow'),
  -- Property — caretaker
  ('49000000-0000-0000-0000-000000000005', 'property',    'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'defect',      'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'defect',      'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'defect',      'edit',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'maintenance', 'view',     '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'maintenance', 'create',   '', 'all', 'allow'),
  ('49000000-0000-0000-0000-000000000005', 'maintenance', 'edit',     '', 'all', 'allow')
on conflict (set_id, resource, action, field) do nothing;
