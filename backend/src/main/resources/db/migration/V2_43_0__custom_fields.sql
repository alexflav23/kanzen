-- F33 extensibility — custom-field definitions + permissions for taxonomies/tags/fields.
-- (entity_tags, taxonomies, taxonomy_nodes, entity_taxonomy_links land in V2_6_0.) Values
-- live in the host entity's `attributes` jsonb; this table types/drives the "add a field" UI.
create table custom_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,
  entity_type   text not null,                       -- asset|vendor|product|person|property|document
  key           text not null,                       -- the attributes jsonb key
  label         text not null,
  type          text not null default 'text' check (type in ('text','number','money','date','bool','enum','url')),
  enum_values   jsonb,
  sensitive     boolean not null default false,      -- inherits host field-level RBAC (F02)
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (entity_type, key)
);
create index custom_field_definitions_entity_idx on custom_field_definitions (entity_type);

-- F33 §2 — Principal defines taxonomies/fields; Manager uses them (tag/categorise/set values);
-- Staff read. tags are operational so Manager may create them too.
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'taxonomy',     null, 'admin'),
  ('manager',   'taxonomy',     null, 'write'),
  ('staff',     'taxonomy',     null, 'read'),
  ('principal', 'custom_field', null, 'write'),
  ('manager',   'custom_field', null, 'read'),
  ('staff',     'custom_field', null, 'read'),
  ('principal', 'tag',          null, 'write'),
  ('manager',   'tag',          null, 'write'),
  ('staff',     'tag',          null, 'read')
on conflict (role_name, resource, field) do nothing;

-- Seed a couple of definitions used by the acceptance scenarios.
insert into custom_field_definitions (owner_id, entity_type, key, label, type, sensitive) values
  ('10000000-0000-0000-0000-000000000001', 'vendor', 'warranty_portal_url', 'Warranty portal URL', 'url',  false),
  ('10000000-0000-0000-0000-000000000001', 'asset',  'insurance_broker_ref', 'Insurance broker ref', 'text', true)
on conflict (entity_type, key) do nothing;
