-- W9 seed — real-shaped threads so the collaborative inbox demos end-to-end (the sandbox stand-in for ingested
-- Gmail). Owner Toby (…001); inboxes on the Wardian + Singapore properties; assignees Lorna(…002)/Marcia(…003)/
-- Siti(…004). Agent proposals carry a human-readable title/summary + confidence — financial/asset → still 'proposed'.

insert into mail_inboxes (id, owner_id, address, label, kind, property_id) values
  ('49000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','wardian@kanzen.family','Wardian','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','deliveries@kanzen.family','Deliveries','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','groceries@kanzen.family','Groceries','shared','20000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','singapore@kanzen.family','Singapore','shared','20000000-0000-0000-0000-000000000002')
on conflict (address) do nothing;

insert into email_threads (id, owner_id, inbox_id, subject, snippet, from_name, last_message_at, unread, has_attachments, status, assignee_id) values
  ('49100000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000003','Your Ocado order is on its way','Delivery Friday 7–8am · 18 items · £142.50','Ocado', now() - interval '40 minutes', true, true, 'open','50000000-0000-0000-0000-000000000003'),
  ('49100000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002','Your Amazon parcel will arrive Friday','Out for delivery · 1Z…99 · Sonos Era 300','Amazon', now() - interval '2 hours', true, false, 'open', null),
  ('49100000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Range Rover — annual service booked','Stratstone Land Rover · Mon 15 Jul, 09:00 · KA21 NZN','Stratstone Land Rover', now() - interval '5 hours', true, true, 'open','50000000-0000-0000-0000-000000000002'),
  ('49100000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Your Octopus Energy bill is ready','£214.30 due 18 Jun · account 8841','Octopus Energy', now() - interval '1 day', true, true, 'open', null),
  ('49100000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000001','Re: dinner on the 14th','Lovely — see you both then. Shall I book Marcus?','Eleanor Whitmore', now() - interval '1 day 3 hours', false, false, 'open', null),
  ('49100000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000004','Pool service — Singapore','Crystal Pools · quarterly clean Thu 4 Jun','Crystal Pools SG', now() - interval '2 days', false, false, 'open','50000000-0000-0000-0000-000000000004'),
  ('49100000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','49000000-0000-0000-0000-000000000002','Your Selfridges receipt','Order #SG-7741 · £1,280.00','Selfridges', now() - interval '3 days', false, true, 'done','50000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into email_messages (id, owner_id, thread_id, direction, from_addr, to_addrs, subject, sent_at, body_text) values
  ('49200000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000001','inbound','orders@ocado.com','groceries@kanzen.family','Your Ocado order is on its way', now() - interval '40 minutes', 'Hello, your Ocado order (ref OC-55218841) totalling £142.50 will be delivered Friday between 7:00 and 8:00am. 18 items including whole milk, sourdough, eggs, coffee, olive oil and household supplies. Your driver is Tomasz.'),
  ('49200000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000002','inbound','ship-confirm@amazon.co.uk','deliveries@kanzen.family','Your Amazon parcel will arrive Friday', now() - interval '2 hours', 'Hi, your parcel (Sonos Era 300, order 205-7741) is out for delivery and will arrive Friday by 1pm. Tracking 1Z999AA10123456784 (UPS).'),
  ('49200000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000003','inbound','service@stratstone.com','wardian@kanzen.family','Range Rover — annual service booked', now() - interval '5 hours', 'Dear Mr Carter, this confirms your Range Rover Autobiography (reg KA21 NZN) is booked in for its annual service on Monday 15 July at 09:00 at Stratstone Land Rover Mayfair. Estimated 950 GBP. Please allow the vehicle for the full day.'),
  ('49200000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000004','inbound','billing@octopus.energy','wardian@kanzen.family','Your Octopus Energy bill is ready', now() - interval '1 day', 'Your latest electricity bill for account 8841 is £214.30, due 18 June. This is higher than your usual monthly amount. View your statement attached.'),
  ('49200000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000005','inbound','eleanor@whitmore.example','wardian@kanzen.family','Re: dinner on the 14th', now() - interval '1 day 3 hours', 'Lovely — see you both then. Shall I book Marcus at 8pm? Let me know if the 14th still works for Toby. E x'),
  ('49200000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000006','inbound','bookings@crystalpools.sg','singapore@kanzen.family','Pool service — Singapore', now() - interval '2 days', 'Good afternoon, your quarterly pool clean is scheduled for Thursday 4 June, 10am. Our technician will need access to the pump room.'),
  ('49200000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000001','49100000-0000-0000-0000-000000000007','inbound','digitalreceipts@selfridges.com','deliveries@kanzen.family','Your Selfridges receipt', now() - interval '3 days', 'Thank you for your purchase. Order #SG-7741, total £1,280.00. Receipt attached.')
on conflict (id) do nothing;

-- the agent's auto-suggested proposals (human-readable; financial/asset locked to 'proposed' per F27)
insert into agent_actions (id, email_id, thread_id, action_type, status, title, summary, confidence) values
  ('49300000-0000-0000-0000-000000000001', null,'49100000-0000-0000-0000-000000000001','create_receipt','proposed','Log the Ocado receipt + expense','£142.50 grocery receipt → expense (Groceries) and add the order to the Grocery — Wardian list.', 0.93),
  ('49300000-0000-0000-0000-000000000002', null,'49100000-0000-0000-0000-000000000002','create_event','proposed','Add the delivery to the calendar','Amazon (Sonos Era 300) out for delivery — add Friday by 1pm to the calendar.', 0.96),
  ('49300000-0000-0000-0000-000000000003', null,'49100000-0000-0000-0000-000000000003','create_event','proposed','Book the Range Rover service','Mon 15 Jul 09:00 at Stratstone — add to the calendar + log a maintenance plan on the Range Rover.', 0.88),
  ('49300000-0000-0000-0000-000000000004', null,'49100000-0000-0000-0000-000000000004','reconcile_bill','proposed','Reconcile the Octopus bill','£214.30 vs your usual ~£180 — flagged +19% variance. Review before paying (Kanzen never pays automatically).', 0.90),
  ('49300000-0000-0000-0000-000000000007', null,'49100000-0000-0000-0000-000000000007','create_receipt','proposed','File the Selfridges receipt','£1,280.00 receipt → expense; propose an asset if it''s a registry item.', 0.84)
on conflict (id) do nothing;

-- a little collaboration already on a thread
insert into entity_comments (id, owner_id, entity_type, entity_id, author_id, body) values
  ('49400000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','email_thread','49100000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Marcia — please make sure the car is available all day and the gate code is shared with Stratstone.')
on conflict (id) do nothing;
