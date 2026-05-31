-- W9.1 / F25 — inbound Gmail fetch idempotency. A fetched thread carries its provider (Gmail) thread id so re-syncing
-- coalesces rather than duplicating. Null for the seeded/hand-authored threads. The real GmailWatcher (history API)
-- drops in behind the EmailSource seam; this column is what makes the pull idempotent.
alter table email_threads add column provider_thread_id text;
create unique index email_threads_provider_idx on email_threads (inbox_id, provider_thread_id)
  where provider_thread_id is not null;
