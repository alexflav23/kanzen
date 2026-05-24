-- F34 event backbone — notifications, subscriptions & device registry (specs/F34).
-- The event_outbox itself lives in V2_15. Here we add the consumer-side surface that the
-- in-process relay + NotificationFanout consumer write to. (Pulsar transport + APNs/FCM/SES
-- delivery are infra, deferred to hardening — channels are recorded as "sent" in sandbox.)

-- Per-user subscription: which event types, which channels, with an optional filter.
create table notification_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null,
  user_id            uuid not null references users(id),
  event_type_pattern text not null,                 -- 'task.completed', 'task.comment.*', '*'
  channels           jsonb not null default '["in_app"]'::jsonb,  -- in_app|email|push
  filter             jsonb not null default '{}'::jsonb,          -- priority/property/mentions_me/assignee
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);
create index notification_subscriptions_user_idx on notification_subscriptions (user_id) where active;

-- Push device registry (one row per device; APNs/FCM/webpush token).
create table device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  platform     text not null check (platform in ('apns','fcm','webpush')),
  token        text not null,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (user_id, token)
);

-- The in-app notification record + per-event-per-user dedup (consumer idempotency).
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id),
  owner_id     uuid not null,
  event_id     uuid references event_outbox(id),
  type         text not null,
  title        text not null,
  body         text,
  subject_type text,
  subject_id   uuid,
  channels_sent jsonb not null default '[]'::jsonb,  -- which channels fanned out (in_app always; push/email mocked)
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  unique (event_id, user_id)                          -- idempotent fan-out: one per event per recipient
);
create index notifications_user_unread_idx on notifications (user_id, created_at) where read_at is null;

-- F02: notifications/subscriptions/devices are per-user self-service; the repo scopes every
-- query to the principal's own user_id, so resource-level read/write for all roles is correct.
insert into permission_rules (role_name, resource, field, level) values
  ('principal', 'notification', null, 'write'),
  ('manager',   'notification', null, 'write'),
  ('staff',     'notification', null, 'write')
on conflict (role_name, resource, field) do nothing;

-- Seed subscriptions that exercise the fan-out + F02 trimming acceptance scenarios:
--  • Flavian (Principal) is pinged in-app + push when a task completes and when stock runs out.
--  • Marcia (Staff) is pushed when a task is assigned to her.
--  • bill.variance_flagged is finance: Flavian + Lorna subscribe; Marcia subscribes too but F02
--    strips her (Staff have no finance visibility) — she must receive nothing (AC5).
insert into notification_subscriptions (owner_id, user_id, event_type_pattern, channels) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'task.completed',        '["in_app","push"]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'product.out_of_stock',  '["in_app"]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'task.assigned',         '["push"]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'bill.variance_flagged', '["in_app"]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'bill.variance_flagged', '["in_app"]'::jsonb),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'bill.variance_flagged', '["in_app","push"]'::jsonb)
on conflict do nothing;
