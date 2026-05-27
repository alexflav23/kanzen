-- Brand catalogue (specs/03-brand-catalogue.md). A GLOBAL master library of maker/brands (shared
-- across all accounts/tenants), crowd-enriched, with per-account hot caches for fast personalised
-- ranking. Stays global under future multi-tenancy while everything else is per-account isolated.

create table brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  normalized  text not null,                       -- lower(trim(name)) — dedup + prefix search
  category    text not null,                        -- watches|jewellery|vehicles|furniture|clothing|guitars|porcelain|glassware|…
  status      text not null default 'community',    -- verified|community
  usage_count bigint not null default 0,            -- global popularity
  created_by  uuid,                                 -- contributing account (null = seeded)
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (category, normalized)
);
create index brands_category_normalized_idx on brands (category, normalized);
create index brands_category_usage_idx on brands (category, usage_count desc);

-- Per-account hot cache: the brands an account actually uses (owner_id = the future tenant/account).
create table brand_usage (
  brand_id     uuid not null references brands (id),
  owner_id     uuid not null,
  count        bigint not null default 0,
  last_used_at timestamptz not null default now(),
  primary key (brand_id, owner_id)
);
create index brand_usage_owner_idx on brand_usage (owner_id, count desc);
