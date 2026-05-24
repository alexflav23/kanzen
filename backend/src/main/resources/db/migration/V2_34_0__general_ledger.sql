-- F18 / ADR-001 — the Postgres double-entry general ledger. gl_splits ARE the ledger;
-- each transaction's signed splits must sum to zero (balanced-or-rejected). Corrections
-- are reversing transactions (immutable originals). Balances derive from the splits.
create table gl_accounts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  code       text unique not null,
  name       text not null,
  type       text not null,                 -- asset|liability|equity|income|expense
  currency   text not null,
  created_at timestamptz not null default now()
);

create table gl_transactions (
  id                      uuid primary key default gen_random_uuid(),
  owner_id                uuid,
  kind                    text not null,     -- expense|income|transfer|acquisition|refund|adjustment|reversal|opening_balance
  description             text,
  occurred_on             date not null default current_date,
  reverses_transaction_id uuid references gl_transactions(id),
  created_at              timestamptz not null default clock_timestamp()
);

create table gl_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references gl_transactions(id),
  account_id     uuid not null references gl_accounts(id),
  amount_minor   bigint not null,            -- signed: +debit / -credit, in the account currency
  memo           text,
  created_at     timestamptz not null default now()
);
create index gl_splits_account_idx on gl_splits (account_id);
create index gl_splits_txn_idx on gl_splits (transaction_id);
