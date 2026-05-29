-- W9.2 — attachment extraction + actionable proposals. Attachments are filed as F05 documents (here seeded as
-- metadata, representing a forwarded receipt/invoice PDF the agent OCR-extracted). The proposal payloads carry the
-- agent's *extracted* fields so confirming actually creates the record (calendar event / expense for approval).

create table email_attachments (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references email_messages(id) on delete cascade,
  document_id  uuid references documents(id),
  filename     text not null,
  content_type text,
  size_bytes   bigint,
  scanned      boolean not null default true,
  safe         boolean default true
);
create index email_attachments_msg_idx on email_attachments (message_id);

insert into email_attachments (message_id, filename, content_type, size_bytes) values
  ('49200000-0000-0000-0000-000000000001','ocado-receipt.pdf','application/pdf',84210),
  ('49200000-0000-0000-0000-000000000003','stratstone-booking.pdf','application/pdf',45120),
  ('49200000-0000-0000-0000-000000000004','octopus-statement.pdf','application/pdf',120340),
  ('49200000-0000-0000-0000-000000000007','selfridges-receipt.pdf','application/pdf',98220)
on conflict do nothing;

-- the agent's extracted fields, so Confirm can create the real record (money-safe: expenses land for approval).
update agent_actions set payload = jsonb_build_object('payee','Ocado','amountMinor',14250,'currency','GBP','description','Ocado grocery order (18 items)') where id = '49300000-0000-0000-0000-000000000001';
update agent_actions set payload = jsonb_build_object('title','Amazon delivery — Sonos Era 300','date',(current_date + 2)::text,'category','delivery') where id = '49300000-0000-0000-0000-000000000002';
update agent_actions set payload = jsonb_build_object('title','Range Rover annual service — Stratstone','date',(current_date + 47)::text,'category','maintenance') where id = '49300000-0000-0000-0000-000000000003';
update agent_actions set payload = jsonb_build_object('payee','Octopus Energy','amountMinor',21430,'currency','GBP','description','Octopus electricity bill') where id = '49300000-0000-0000-0000-000000000004';
update agent_actions set payload = jsonb_build_object('payee','Selfridges','amountMinor',128000,'currency','GBP','description','Selfridges purchase') where id = '49300000-0000-0000-0000-000000000007';
