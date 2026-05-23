-- F14 reconciliation (specs/F14). N:M matches between transactions and receipts.
create table reconciliation_matches (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid,
  state      text not null default 'matched',  -- matched|split|transfer|refund|ignored
  created_at timestamptz not null default now()
);

create table match_members (
  match_id     uuid not null references reconciliation_matches(id),
  member_type  text not null,                   -- transaction|receipt
  member_id    uuid not null,
  amount_minor bigint,
  primary key (match_id, member_type, member_id)
);
