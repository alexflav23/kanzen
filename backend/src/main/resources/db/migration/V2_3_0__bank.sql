-- F12 bank ingestion (specs/F12). AIS transactions (GoCardless/CSV); idempotent.
create table financial_accounts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  name       text not null,
  currency   text not null,
  kind       text,
  created_at timestamptz not null default now()
);

create table bank_transactions (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid,
  account_id          uuid not null references financial_accounts(id),
  provider_tx_id      text,
  booked_on           date,
  amount_minor        bigint not null,
  currency            text not null,
  direction           text not null,                 -- debit|credit
  description         text,
  merchant            text,
  reconciliation_state text not null default 'unmatched',
  fx_rate_to_base     numeric,
  fx_as_of            date,
  created_at          timestamptz not null default now(),
  unique (account_id, provider_tx_id)
);
create index bank_transactions_account_idx on bank_transactions (account_id, booked_on desc);
