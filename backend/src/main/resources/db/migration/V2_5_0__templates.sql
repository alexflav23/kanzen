-- F22 category templates (specs/F22). Typed schema validates JSONB attributes.
create table category_templates (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references categories(id),
  vertical_key text not null,
  name         text,
  version      int not null default 1,
  schema       jsonb not null,         -- [{key,type,required}, ...]
  created_at   timestamptz not null default now()
);
create index category_templates_vertical_idx on category_templates (vertical_key, version desc);
