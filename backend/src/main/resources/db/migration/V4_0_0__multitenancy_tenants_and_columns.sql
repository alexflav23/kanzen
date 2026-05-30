-- F45 W10 — Multi-tenancy step 1 (V4_0_0): the tenants table + a tenant_id column on every
-- domain row, NULLABLE with a DB DEFAULT to the seeded 'default' tenant. Adding a column with a
-- constant default backfills existing rows in place (PG11+), so existing code that never sets
-- tenant_id keeps inserting fine and the whole suite stays green. The per-domain repo sweep later
-- replaces the default with the principal's tenant + adds the read filter (one domain per commit).

create table if not exists tenants (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  plan              text not null default 'free',
  status            text not null default 'active',
  settings          jsonb not null default '{}'::jsonb,
  principal_user_id uuid references users(id),
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists tenants_slug_idx on tenants(slug);

insert into tenants (id, slug, name, principal_user_id)
  values ('7e000000-0000-0000-0000-000000000001', 'default', 'The Carter household', '10000000-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

alter table approvals add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table asset_events add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table asset_groups add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table asset_parties add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table asset_quality_flags add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table asset_valuation_snapshots add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table assets add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table audit_log_entries add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table bank_transactions add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table bills add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table brand_usage add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table budgets add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table calendar_event_refs add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table categories add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table collection_members add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table custom_field_definitions add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table defects add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table documents add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table email_drafts add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table email_messages add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table email_threads add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table employment_records add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table entity_comments add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table entity_documents add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table entity_links add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table export_jobs add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table financial_accounts add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table gl_accounts add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table gl_transactions add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table investment_lots add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table locations add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table mail_inboxes add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table maintenance_plans add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table net_worth_snapshots add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table notification_subscriptions add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table notifications add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table payment_methods add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table products add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table properties add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table receipts add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table reconciliation_matches add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table restore_jobs add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table restructure_operations add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table search_index add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table shopping_lists add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table tags add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table task_projects add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table tasks add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table taxonomies add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table users add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table vendors add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
alter table wealth_entities add column if not exists tenant_id uuid references tenants(id) default '7e000000-0000-0000-0000-000000000001';
