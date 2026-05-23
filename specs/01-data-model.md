# Kanzen — Consolidated data model & migration order

A cross-feature view of every table, the key relationships, and the **Flyway migration order**, to catch FK/ordering issues before migrations are written. Source of truth per table = the owning feature spec. Conventions: `uuid` PKs (`gen_random_uuid()`), `timestamptz`, **money = integer minor units + currency**, `owner_id` on every domain row, soft delete `deleted_at`, audit via `audit_log_entries`.

## Migration order (Flyway, dependency-safe)
1. **Baseline** (F00) — extensions `pgcrypto`/`citext`/**`vector` (pgvector)**; `audit_log_entries`.
2. **Identity** (F01) — `users`, `login_identities`, `user_preferences`, `sessions`.
3. **AuthZ** (F02) — `roles`, `permission_rules`, `property_scopes`; alter `users.role_id`.
3b. **Extensibility** (F33, cross-cutting) — `taxonomies`, `taxonomy_nodes`, `entity_taxonomy_links`, `tags`, `entity_tags`, `entity_templates`, `custom_field_definitions`. Each extensible entity also gets an **`attributes jsonb`** column (added by its own migration: assets F04, vendors F09, list_items F08, people F10, properties F03, documents F05).
3c. **Event backbone** (F34, foundational) — `event_outbox` (transactional outbox → Pulsar), `notification_subscriptions`, `device_tokens`; extends `notifications` (F06) with per-channel delivery. Consumers: notifications/push, search index (F28), ledger (F18), audit (F00), learned memory (F13).
4. **Properties** (F03) — `properties`, `locations` (nested tree), `asset_location_history`*, `asset_custody_history`* (*asset FK added in F04), `defects`.
5. **Assets** (F04) — `categories`, `assets` (+ `jsonb attributes`), `asset_groups(+members)`, `collections(+members)`, `tags`/`asset_tags`; add asset FKs to F03 history tables.
6. **Documents** (F05) — `documents`, `document_versions`, `document_links` (polymorphic).
7. **Tasks** (F06) — `task_projects`, `tasks`, `task_labels(+links)`, `task_comments`, **`notifications`** (shared); link `properties.task_project_id`.
8. **Calendar** (F07) — `calendars`, `calendar_event_refs`.
9. **Lists** (F08) — `shopping_lists`, `list_items`.
9b. **Products & stock** (F35) — `products`, `product_vendors`, `product_stock_events` (out/low → Lists buy request via F34).
10. **Vendors** (F09) — `vendors`, `vendor_property_link`, `asset_party_link`.
11. **People** (F10) — `employment_records`, `leave`.
12. **Maintenance/Reminders** (F11) — `maintenance_plans`, `maintenance_logs`, **`reminders`** (shared engine).
13. **Bank** (F12) — `financial_institutions`, `financial_connections`, `financial_accounts`, `bank_transactions`, `bank_transaction_raw_payloads`, `merchants`, `transaction_categories`, `bank_sync_jobs`.
14. **Receipts/OCR** (F13) — `receipts`, `receipt_parse_runs`, `receipt_line_items`, **`line_item_memory` (pgvector)**.
15. **Reconciliation** (F14) — `reconciliation_matches`, `match_members`, `transaction_splits`.
16. **Bills** (F15) — `bills`.
17. **Payments** (F16) — `payment_methods`, `bill_payments`.
18. **Budgets/Expenses** (F17) — `expenses`, `approvals` (polymorphic), `associated_costs(+asset_link)`, `budgets`.
19. **Ledger** (F18) — `ledger_account_mappings`, `ledger_posting_groups`, `ledger_posting_references` (TigerBeetle holds accounts/transfers).
20. **Asset depth** (F19–F24) — `asset_events`, `asset_valuation_snapshots`, `asset_warranties`, `asset_insurance`, `category_templates`, `asset_attribute_definitions`, `asset_completeness`, `asset_quality_flags`, `restructure_operations`, `asset_import_batches(+rows)`.
21. **Agent** (F25–F27) — `incoming_emails`, `agent_actions`, `agent_action_result_link`, `sender_rules`, `rules`, `trust_settings`.
22. **Search** (F28) — `search_index` (FTS + trigram + **vector**), `saved_searches`, `recent_items`.
23. **Insights** (F29) — materialised views (`mv_*`), `dashboard_widgets`.
24. **Backup** (F30) — `export_jobs`, `export_manifests`, `restore_jobs`, `backup_artifacts`, `archive_snapshots`.
25. **Advanced** (F32) — `nl_query_log`.

## Domain map (key FKs)
- **Identity/AuthZ**: `users.role_id → roles`; `permission_rules.role_id → roles`; `property_scopes.{user_id,property_id}`; `login_identities.user_id`, `sessions.{user_id,login_identity_id}`.
- **Place → things**: `locations.{property_id,parent_id}`; `assets.{category_id,location_id,parent_asset_id,hero_document_id,merchant_id}`; history tables `asset_*_history.{asset_id,location_id}`.
- **Evidence**: `document_links(document_id, target_type, target_id)` polymorphic → asset/transaction/property/person/vendor/receipt/defect; `receipts.document_id`; `receipt_line_items.{receipt_id,parse_run_id,confirmed_category_id,asset_link_id}`.
- **Money**: `bank_transactions.account_id → financial_accounts → financial_connections`; `reconciliation match_members(member_type∈{transaction,receipt})`; `bills.{vendor_id,property_id,payment_method_id}`; `bill_payments.{bill_id,payment_method_id,bank_transaction_id}`; `expenses.{property_id,category_id,receipt_id,bank_transaction_id,payment_method_id}`; `associated_cost_asset_link.{associated_cost_id,asset_id}`; `ledger_posting_references.group_id`.
- **Ops**: `tasks.{project_id,assignee_id,source_*}`; `reminders.{source_type,source_id}` (cross-domain); `maintenance_plans.{property_id,asset_id,vendor_id}`; `shopping_lists.{property_id,vendor_id,assignee_id}`; `defects.{property_id,location_id,assigned_vendor_id,linked_task_id}`.
- **Learning**: `line_item_memory` (confirmed line items) + `search_index.embedding` use **pgvector**; `rules`/`trust_settings` drive the agent + categorisation.
- **Extensibility (F33)**: polymorphic `entity_tags(tag_id, entity_type, entity_id)` + `entity_taxonomy_links(taxonomy_node_id, entity_type, entity_id)` (no entity FKs — works for any object); `taxonomy_nodes.parent_id` = infinite tree; `attributes jsonb` on every extensible entity (the asset `categories` tree is the built-in `is_system` taxonomy).

## Cross-feature watch-list (resolved by ordering/notes above)
- `asset_location_history`/`asset_custody_history` are **defined in F03** but their **asset FK is added in F04** (assets exist later).
- `users.role` (text, F01) becomes **`users.role_id` (FK, F02)** — backfill by name.
- `notifications` (F06) and `reminders` (F11) are **shared infra** consumed by many features (agent, finance, HR, backup).
- `merchants` (F12) reused by F13 (receipts) and F14 (reconciliation).
- `line_item_memory` (F13) + `search_index` (F28) both need **pgvector** (enabled in F00 baseline).
- `approvals` (F17) is **polymorphic** (expense / list_item / maintenance).
- `asset.market_value`/`insured_value`/`valuation_snapshots` are the **Principal-only** fields enforced by F02 field-filtering everywhere (search, insights, API).

## Notes
- TigerBeetle stores accounts/transfers **outside Postgres**; the Postgres ledger tables are the mapping/metadata only.
- Materialised views (F29) refresh incrementally; treat as derived.
- This file is updated whenever a feature spec changes a table; the owning `F__` spec remains the detailed source of truth.
