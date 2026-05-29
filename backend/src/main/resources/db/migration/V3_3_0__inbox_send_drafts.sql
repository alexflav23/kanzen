-- W9.4a: reply/send + shared drafts. Outbound messages reuse email_messages (direction='outbound'); rich bodies are
-- stored as sanitized HTML. A shared draft is collaborative — one per thread, last-writer-wins on updated_at.

alter table email_messages add column if not exists body_html text;

create table if not exists email_drafts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null,
  thread_id  uuid not null references email_threads(id) on delete cascade,
  author_id  uuid not null,            -- last writer (shared draft)
  body_html  text not null default '',
  updated_at timestamptz not null default now(),
  unique (thread_id)                   -- one shared draft per thread
);
create index if not exists email_drafts_thread_idx on email_drafts(thread_id);
