-- W9 — Collaborative Inbox (spec: F25-F26v2). The threaded mailbox + collaboration layer on top of the F25
-- agent engine. Sandbox spine: threads/messages are seeded (representing ingested mail) behind the EmailSource
-- seam; live Gmail wires in later. agent_actions is extended (non-breaking) with a human-readable proposal +
-- thread link + confidence. Generic collaboration tables (entity_comments / entity_links) per spec §11a.

create table mail_inboxes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  address     text not null,
  label       text not null,
  kind        text not null default 'shared',   -- shared|personal|catch_all
  property_id uuid references properties(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (address)
);

create table email_threads (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null,
  inbox_id        uuid not null references mail_inboxes(id),
  subject         text,
  snippet         text,
  from_name       text,                          -- the headline correspondent
  last_message_at timestamptz not null default now(),
  unread          boolean not null default true,
  has_attachments boolean not null default false,
  status          text not null default 'open',  -- open|snoozed|done|archived
  snoozed_until   timestamptz,
  assignee_id     uuid references employment_records(id),
  created_at      timestamptz not null default now()
);
create index email_threads_inbox_idx on email_threads (inbox_id, status, last_message_at desc);

create table email_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null,
  thread_id  uuid not null references email_threads(id) on delete cascade,
  direction  text not null default 'inbound',    -- inbound|outbound
  from_addr  text,
  to_addrs   text,
  subject    text,
  sent_at    timestamptz not null default now(),
  body_text  text,                               -- sandbox: trusted plain text; live: + body_html + raw_s3_key
  sent_by    uuid,
  created_at timestamptz not null default now()
);
create index email_messages_thread_idx on email_messages (thread_id, sent_at);

-- generic collaboration layer (spec §11a) — comments + links on ANY entity, reusable beyond the inbox
create table entity_comments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  entity_type text not null,
  entity_id   uuid not null,
  author_id   uuid not null,
  body        text not null,
  mentions    uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index entity_comments_idx on entity_comments (entity_type, entity_id, created_at);

create table entity_links (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null,
  source_type text not null,
  source_id   uuid not null,
  target_type text not null,
  target_id   uuid not null,
  role        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  unique (source_type, source_id, target_type, target_id)
);
create index entity_links_source_idx on entity_links (source_type, source_id);
create index entity_links_target_idx on entity_links (target_type, target_id);

-- extend agent_actions (non-breaking): a thread link + a human-readable proposal + confidence (the "auto-suggested
-- intelligence" surfaced on a thread). email_id stays for the legacy F25 rows.
alter table agent_actions add column if not exists thread_id  uuid references email_threads(id);
alter table agent_actions add column if not exists title      text;
alter table agent_actions add column if not exists summary    text;
alter table agent_actions add column if not exists confidence numeric;
alter table agent_actions add column if not exists payload    jsonb;

-- role rules (legacy bridge): Manager manages the inbox; Staff read it (the repo scopes them to their own
-- threads / property) and can collaborate (comment/status) on those. Principal already holds '*'.
insert into permission_rules (role_name, resource, field, level) values
  ('manager', 'inbox',  null, 'write'), ('manager', 'thread', null, 'write'),
  ('staff',   'inbox',  null, 'read'),  ('staff',   'thread', null, 'write')
on conflict (role_name, resource, field) do nothing;
