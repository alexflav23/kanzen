-- F37 currencies & FX (specs/F37). Native amounts are truth; FX is an overlay.
create table currencies (
  code     text primary key,
  symbol   text,
  decimals int not null default 2,
  active   boolean not null default true
);

create table fx_rates (
  id    uuid primary key default gen_random_uuid(),
  base  text not null,
  quote text not null,
  rate  double precision not null,
  as_of date not null,
  source text,
  unique (base, quote, as_of)
);
