-- F13 receipts (specs/F13). Commercial evidence + line items (OCR via Bedrock later).
create table receipts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid,
  kind        text not null default 'receipt',  -- receipt|invoice
  merchant    text,
  total_minor bigint,
  currency    text,
  status      text not null default 'parsed',    -- parsing|needs_review|confirmed|parsed
  created_at  timestamptz not null default now()
);

create table receipt_line_items (
  id                 uuid primary key default gen_random_uuid(),
  receipt_id         uuid not null references receipts(id),
  line_no            int,
  description        text,
  total_minor        bigint,
  currency           text,
  suggested_category text,
  confirmed_category text,
  status             text not null default 'suggested'  -- suggested|confirmed|ignored
);
create index receipt_line_items_receipt_idx on receipt_line_items (receipt_id);
