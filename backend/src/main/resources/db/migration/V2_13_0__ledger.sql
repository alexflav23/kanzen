-- F18 ledger (specs/F18). Double-entry posting model (TigerBeetle in production; Postgres here).
create table ledger_accounts (
  id       uuid primary key default gen_random_uuid(),
  code     text unique not null,
  name     text,
  type     text not null,      -- asset|liability|equity|income|expense
  currency text not null
);

create table ledger_posting_groups (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,    -- acquisition|refund|maintenance_cost|transfer|adjustment
  occurred_at timestamptz not null default now()
);

create table ledger_postings (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references ledger_posting_groups(id),
  debit_account  uuid not null references ledger_accounts(id),
  credit_account uuid not null references ledger_accounts(id),
  amount_minor   bigint not null,
  currency       text not null
);
