-- F46/SES — the Mailer seam's sandbox sink. Every outbound email (verification magic-links, notifications) is recorded
-- here by StubMailer so the dev environment can see + complete flows without a live SES; the real SesMailer swaps in
-- behind the same trait (operator-gated) and these rows become a delivery audit trail.
create table outbound_emails (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references tenants(id) on delete cascade,
  to_email    text not null,
  subject     text not null,
  body        text not null,
  kind        text not null default 'generic',  -- e.g. 'verify_email'
  created_at  timestamptz not null default now()
);
create index outbound_emails_to_idx on outbound_emails (to_email, created_at desc);
