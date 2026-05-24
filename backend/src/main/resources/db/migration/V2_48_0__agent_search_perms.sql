-- Wave E (F25/F26/F27/F28/F32) — permissions for the agent pipeline, inbox/triage, trust,
-- search and NL query. Gmail fetch + Bedrock classification + pgvector embeddings are external
-- (deferred to hardening); the rule-based classify/translate stand in for the sandbox.
insert into permission_rules (role_name, resource, field, level) values
  -- agent pipeline + inbox triage + trust settings
  ('principal', 'agent',  null, 'admin'),
  ('manager',   'agent',  null, 'write'),
  -- search is readable by all; results are still filtered per entity-type by each role's perms
  ('principal', 'search', null, 'read'),
  ('manager',   'search', null, 'read'),
  ('staff',     'search', null, 'read')
on conflict (role_name, resource, field) do nothing;

-- Seed the default trust routing: financial/asset categories LOCKED to review (never auto),
-- operational categories default to review until the Principal opts into auto.
insert into trust_settings (category, routing, locked) values
  ('Bill / Invoice', 'review', true),
  ('Receipt',        'review', true),
  ('Asset',          'review', true),
  ('Delivery',       'review', false),
  ('Booking',        'review', false)
on conflict (category) do nothing;
