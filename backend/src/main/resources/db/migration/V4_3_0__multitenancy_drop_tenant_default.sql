-- F45 W10 — final hardening: drop the tenant_id DB default. Every runtime insert into a tenant-scoped table now
-- sets tenant_id explicitly (verified: 0 gaps), so the V4_0_0 default is no longer the backstop — it's a footgun
-- (a future insert that forgets tenant_id would silently land in the seeded tenant). Dropping it makes such a
-- mistake fail loudly. The column stays NOT NULL (V4_0_1/V4_0_2).

alter table approvals alter column tenant_id drop default;
alter table asset_events alter column tenant_id drop default;
alter table asset_groups alter column tenant_id drop default;
alter table asset_parties alter column tenant_id drop default;
alter table asset_quality_flags alter column tenant_id drop default;
alter table asset_valuation_snapshots alter column tenant_id drop default;
alter table assets alter column tenant_id drop default;
alter table audit_log_entries alter column tenant_id drop default;
alter table bank_transactions alter column tenant_id drop default;
alter table bills alter column tenant_id drop default;
alter table brand_usage alter column tenant_id drop default;
alter table budgets alter column tenant_id drop default;
alter table calendar_event_refs alter column tenant_id drop default;
alter table categories alter column tenant_id drop default;
alter table collections alter column tenant_id drop default;
alter table custom_field_definitions alter column tenant_id drop default;
alter table defects alter column tenant_id drop default;
alter table documents alter column tenant_id drop default;
alter table email_drafts alter column tenant_id drop default;
alter table email_messages alter column tenant_id drop default;
alter table email_threads alter column tenant_id drop default;
alter table employment_records alter column tenant_id drop default;
alter table entity_comments alter column tenant_id drop default;
alter table entity_documents alter column tenant_id drop default;
alter table entity_links alter column tenant_id drop default;
alter table expenses alter column tenant_id drop default;
alter table export_jobs alter column tenant_id drop default;
alter table financial_accounts alter column tenant_id drop default;
alter table gl_accounts alter column tenant_id drop default;
alter table gl_transactions alter column tenant_id drop default;
alter table investment_lots alter column tenant_id drop default;
alter table locations alter column tenant_id drop default;
alter table mail_inboxes alter column tenant_id drop default;
alter table maintenance_plans alter column tenant_id drop default;
alter table net_worth_snapshots alter column tenant_id drop default;
alter table notification_subscriptions alter column tenant_id drop default;
alter table notifications alter column tenant_id drop default;
alter table payment_methods alter column tenant_id drop default;
alter table products alter column tenant_id drop default;
alter table properties alter column tenant_id drop default;
alter table receipts alter column tenant_id drop default;
alter table reconciliation_matches alter column tenant_id drop default;
alter table restore_jobs alter column tenant_id drop default;
alter table restructure_operations alter column tenant_id drop default;
alter table search_index alter column tenant_id drop default;
alter table shopping_lists alter column tenant_id drop default;
alter table tags alter column tenant_id drop default;
alter table task_projects alter column tenant_id drop default;
alter table tasks alter column tenant_id drop default;
alter table taxonomies alter column tenant_id drop default;
alter table users alter column tenant_id drop default;
alter table vendors alter column tenant_id drop default;
alter table wealth_entities alter column tenant_id drop default;
