-- F16 payment methods & pay queue (specs/F16). Kanzen never moves money.
create table payment_methods (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid,
  type         text not null,            -- credit_card|bank_account|multi_currency
  display_name text not null,
  last4        text,
  currency     text,
  vault_ref    text,                      -- 1Password name; never a secret
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);

create table bill_payments (
  id                uuid primary key default gen_random_uuid(),
  bill_id           uuid references bills(id),
  payment_method_id uuid references payment_methods(id),
  due_date          date,
  amount_minor      bigint not null,
  currency          text not null,
  mode              text not null,        -- auto|manual|review
  state             text not null default 'scheduled', -- scheduled|settled|paid|review|ignored
  created_at        timestamptz not null default now()
);
