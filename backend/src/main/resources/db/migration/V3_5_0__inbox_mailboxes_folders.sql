-- W9.4: make the inbox mailboxes the single source of truth (the Directory reads the same set) and give each mailbox
-- standard folders (Inbox · Sent · Spam · Archive). Sent is derived (has an outbound message); Archive = done/archived;
-- Spam = the spam flag; Inbox = open & not spam.

alter table email_threads add column if not exists spam boolean not null default false;

-- The canonical mailbox set == the Directory (operational 'shared' + 'role'/property addresses).
update mail_inboxes set address = 'house@kanzen.family', label = 'House', kind = 'shared'
  where id = '49000000-0000-0000-0000-000000000003';                                  -- was groceries@
update mail_inboxes set kind = 'shared' where id = '49000000-0000-0000-0000-000000000002';  -- Deliveries
update mail_inboxes set kind = 'role'   where id in ('49000000-0000-0000-0000-000000000001',  -- Wardian
                                                     '49000000-0000-0000-0000-000000000004'); -- Singapore

insert into mail_inboxes (id, owner_id, address, label, kind, property_id) values
  ('49000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','accounts@kanzen.family','Accounts','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','vendors@kanzen.family','Vendors','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','concierge@kanzen.family','Concierge','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000001','flavian@kanzen.family','Principal','role',null),
  ('49000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','lorna@kanzen.family','Chief of Staff','role',null)
on conflict (address) do nothing;

-- Re-point existing threads to the best-fit canonical mailbox.
update email_threads set inbox_id = '49000000-0000-0000-0000-000000000002' where id = '49100000-0000-0000-0000-000000000001'; -- Ocado → Deliveries
update email_threads set inbox_id = '49000000-0000-0000-0000-000000000005' where id = '49100000-0000-0000-0000-000000000004'; -- Octopus bill → Accounts
update email_threads set inbox_id = '49000000-0000-0000-0000-000000000008' where id = '49100000-0000-0000-0000-000000000005'; -- Eleanor (personal) → Principal

-- Sent: a prior reply on the Singapore pool thread (so the Sent folder isn't empty).
update email_threads set status = 'open' where id = '49100000-0000-0000-0000-000000000006';
insert into email_messages (id, owner_id, thread_id, direction, from_addr, to_addrs, subject, body_text, body_html, sent_at, sent_by) values
  ('49200000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000006',
   'outbound','singapore@kanzen.family','bookings@crystalpools.sg','Re: Pool service — Singapore',
   'Thank you — Siti will provide access to the pump room on Thursday.',
   '<p>Thank you — Siti will provide access to the pump room on Thursday.</p>',
   now() - interval '1 day 20 hours','10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- Spam: a phishing "parcel held, pay redelivery" in Deliveries, flagged by the agent.
insert into email_threads (id, owner_id, inbox_id, subject, snippet, from_name, last_message_at, unread, has_attachments, status, spam, assignee_id) values
  ('49100000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002',
   'Your parcel is held — pay £1.99 redelivery','We attempted delivery. Pay the fee to release your parcel.','Royal M4il',
   now() - interval '6 hours', true, false, 'open', true, null)
on conflict (id) do nothing;
insert into email_messages (id, owner_id, thread_id, direction, from_addr, to_addrs, subject, body_text, sent_at) values
  ('49200000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000009',
   'inbound','no-reply@royalm4il-delivery.top','deliveries@kanzen.family','Your parcel is held — pay £1.99 redelivery',
   'Dear customer, we were unable to deliver your parcel. Please pay a small redelivery fee of £1.99 at the link below within 24 hours or your item will be returned.',
   now() - interval '6 hours')
on conflict (id) do nothing;
