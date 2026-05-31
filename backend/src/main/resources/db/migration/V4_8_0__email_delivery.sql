-- F46/SES — turn outbound_emails into a delivery queue. The Mailer records a row (recipient + body); a delivery worker
-- drains the undelivered rows through the EmailTransport seam (StubEmailTransport marks them delivered in the sandbox;
-- the real SesEmailTransport actually sends once the operator verifies the domain). delivered_at null ⇒ still pending.
alter table outbound_emails add column delivered_at    timestamptz;
alter table outbound_emails add column delivery_error  text;
alter table outbound_emails add column attempts        int not null default 0;
create index outbound_emails_undelivered_idx on outbound_emails (created_at) where delivered_at is null;
