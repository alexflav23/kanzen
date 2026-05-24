-- F34 demo seed — a couple of in-app notifications for Flavian (Principal) so the notification
-- centre renders real unread items. In production these are written by the NotificationFanout
-- consumer when events are relayed; seeded directly here (event_id null) for the sandbox.
-- (NotificationsApiIT/NotificationFanoutIT scope to their own emitted events, so this seed
-- can't affect them; no audit rows written.)
insert into notifications (id, user_id, owner_id, type, title, body, subject_type, channels_sent, created_at) values
  ('49000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'task.completed', 'Task completed', 'Marcia completed "Service the boiler" at Wardian', 'task', '["in_app","push"]'::jsonb, now() - interval '20 minutes'),
  ('49000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   'bill.variance_flagged', 'A bill is outside its expected range', 'British Gas £220.00 — +15% on the usual', 'bill', '["in_app"]'::jsonb, now() - interval '3 hours')
on conflict (id) do nothing;
