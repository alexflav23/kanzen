-- F35 products & stock (specs/F35). Consumables: preferred spec, vendors+buy links, stock.
create table products (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid,
  property_id    uuid references properties(id),
  name           text not null,
  preferred_spec text,
  unit           text,
  stock_status   text not null default 'in_stock',  -- in_stock|low|out
  attributes     jsonb not null default '{}',
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create table product_vendors (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references products(id),
  vendor_name  text,
  buy_url      text,
  preferred    boolean not null default false
);
