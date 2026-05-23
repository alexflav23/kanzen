-- F25 email agent (specs/F25). Ingested mail -> classified -> proposed actions.
create table incoming_emails (
  id         uuid primary key default gen_random_uuid(),
  mailbox    text,
  from_addr  text,
  subject    text,
  category   text,
  confidence numeric,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

create table agent_actions (
  id          uuid primary key default gen_random_uuid(),
  email_id    uuid references incoming_emails(id),
  action_type text not null,
  status      text not null default 'proposed',  -- proposed|confirmed|rejected|executed
  created_at  timestamptz not null default now()
);
