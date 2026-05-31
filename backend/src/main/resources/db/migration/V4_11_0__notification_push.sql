-- F34/APNs+FCM — push-notification delivery tracking. A notification whose channels include 'push' needs a device push;
-- a worker drains the un-pushed ones through the PushTransport seam (StubPushTransport is a no-op success in the sandbox;
-- the real APNs/FCM client drops in behind the trait). pushed_at null + 'push' channel ⇒ still to deliver.
alter table notifications add column pushed_at  timestamptz;
alter table notifications add column push_error text;
create index notifications_unpushed_idx on notifications (created_at)
  where pushed_at is null and channels_sent @> '["push"]'::jsonb;
