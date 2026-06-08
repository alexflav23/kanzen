# F45 — Multi-tenancy (the foundation pass)

**Status**: 🟡 Spec — 2026-05-30. **Largest architectural pass since F00.** Touches every domain table, every repo query, every endpoint, every authz check. Plan + sequence carefully.

**Reads as**: a foundation pass, not a feature. The user-visible win is "Kanzen is now a platform that can host other households / orgs"; the internal win is row-level tenant isolation enforced server-side, with no leak path.

---

## 1. Why now

Today: single-tenant by assumption. The Flavian household is the only "owner"; every domain row carries `owner_id = <flavian's user id>`. This is fine until the moment we want to onboard a second household — at which point retrofitting `tenant_id` becomes painful across ~50 tables.

The user has now asked for multi-tenancy as a prerequisite for **comprehensive onboarding** (F46). Doing it now means every future write is tenancy-aware from line one. Doing it later means a much riskier and slower retrofit on top of more code.

## 2. Architectural choice — row-level, not schema-per-tenant

Two real options:
- **A: Schema-per-tenant**. Each tenant gets its own Postgres schema; queries are schema-scoped via the connection's `search_path`. Strong isolation, harder to operate (per-tenant migrations, connection routing, backup), much more expensive at our scale (small households, many tenants).
- **B: Row-level with `tenant_id`**. Every domain table gets `tenant_id uuid not null`; every query filters by it; one schema; centralised migrations.

**Choose B.** Single schema, one migration set, simpler ops, room for ~10,000 tenants without strain. Strong isolation is enforced at the **`Authz` + repo** layer, not the DB layer (defence-in-depth via a per-test "no-leak" sweep in §6.3).

## 3. Data model

### 3.1 The tenants table

```sql
create table tenants (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,        -- "wardian-toby", appears in subdomain
  name        text not null,                -- "The Carter family", appears in UI
  plan        text not null default 'free', -- free | family | enterprise
  status      text not null default 'active', -- active | suspended | archived
  -- per-tenant settings (UI prefs, integrations metadata, ...)
  settings    jsonb not null default '{}'::jsonb,
  -- the principal user (the owner-of-the-tenant) is recorded for boot-strap UX,
  -- but actual ownership is permissioned via the F02v2 RBAC.
  principal_user_id uuid references users(id),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index tenants_slug_idx on tenants(slug);
```

### 3.2 The instrumentation

Every domain table gets a `tenant_id uuid` column referencing `tenants(id)`. Migration plan:

**V4_0_0 — add column nullable + default tenant.**
- Create the `tenants` table.
- Insert the **default tenant** (`slug = 'default'`, `name = 'The Carter household'`, `principal_user_id = <flavian>`).
- `alter table <each domain table> add column tenant_id uuid references tenants(id);`
- Backfill: `update <each domain table> set tenant_id = '<default-tenant-id>' where tenant_id is null;`

**V4_0_1 — NOT NULL + composite indexes.**
- `alter table <each domain table> alter column tenant_id set not null;`
- For tables already indexed on `owner_id`: replace with `(tenant_id, owner_id)` composite.
- For tables read by `(parent_id)` heavily (e.g. `task_links.task_id`): add `(tenant_id, parent_id)` covering index.

The domain tables (audited list — `find */migration -name "create table"`):
- Registry: `assets`, `asset_events`, `asset_tags`, `asset_attachments`, `collections`, `collection_assets`, `groups`, `group_members`, `categories`, `taxonomies`, `tags`, `brands`, `brand_usage`, `vehicle_template_fields`.
- Property: `properties`, `locations`, `defects`, `linked_systems`, `property_bible_sections`.
- Finance: `bills`, `expenses`, `payment_methods`, `payment_schedule`, `bank_accounts`, `transactions`, `reconciliations`, `receipts`, `receipt_line_items`, `ledger_postings`, `accounts`, `accounts_categories`, `budgets`, `tax_rules`.
- Wealth: `wealth_accounts`, `holdings`, `lots`, `valuations`, `securities`, `trades`, `entities`.
- Operations: `tasks`, `task_links`, `task_projects`, `shopping_lists`, `list_items`, `maintenance_plans`, `maintenance_completions`, `products`, `supplies`, `calendar_event_refs`.
- Comms: `mail_inboxes`, `email_threads`, `email_messages`, `email_attachments`, `email_drafts`, `agent_actions`, `entity_comments`, `entity_links`.
- People & roles: `employment_records`, `vendors`, `roles`, `permission_sets`, `permission_set_grants`, `user_roles`, `permission_rules`, `teams`, `team_members`.
- System: `documents`, `audit_log_entries`, `event_outbox`, `notifications`, `notification_preferences`, `entity_documents`.
- New (F44): `workspace_integrations`.

That's ~60 tables. ~10 of them have no tenant ownership (lookup tables like `categories` if those are global — TBD per-table during sweep).

## 4. Principal + Authz

### 4.1 Principal gains `tenantId`

```scala
final case class Principal(
  userId: UUID,
  subject: String,
  email: String,
  role: String,
  tenantId: UUID  // NEW — resolved from the JWT claim `custom:tenant_id`
)
```

The DevAuth `mint` and Cognito `JwtVerifier` both populate it. For backward compat during rollout: if the claim is missing, fall back to the default tenant's id (no-op for existing dev tokens).

### 4.2 Authz filter

A single helper that every repo write/read includes:

```scala
// com.kanzen.authz.Authz
object Authz {
  /** SQL predicate that constrains a query to the principal's tenant. Composed into every read/write. */
  def tenantFilter(p: Principal): Fragment = fr"and t.tenant_id = ${p.tenantId}"
}
```

Repo queries become:
```scala
def list(p: Principal): ConnectionIO[List[Asset]] =
  (fr"select ... from assets a where a.deleted_at is null" ++ Authz.tenantFilter_a(p)).query[Asset].to[List]
```

Per-table macro (`tenantFilter_a`, `tenantFilter_i`, ...) provides the alias variant. Cheap to mass-rewrite via grep + perl.

### 4.3 Cross-tenant access — forbidden

No superadmin override. **Ever.** Operating across tenants requires reauthentication as that tenant's principal. The impersonation engine (F02) stays within the tenant.

## 5. Routing

### 5.1 Subdomain-based — recommended

Tenant identified by subdomain: `<slug>.kanzen.app`. Front door:
- Browser hits `wardian-toby.kanzen.app/login`.
- Cognito user pool is **per-tenant** OR **shared with `custom:tenant_slug`** — choose **shared**, gated by the slug claim. Cheaper to operate.
- Backend: `Auth` middleware reads the host header to compute `expectedTenantSlug`; cross-checks with the JWT's `custom:tenant_id`; rejects mismatches.
- Static front-end serves the same bundle from any subdomain (Vite build is identical); tenant slug surfaces in the UI (top-bar brand → "Wardian Carter") from the JWT.

### 5.2 Path-based — fallback for local dev

Local dev can't easily provision subdomains. Use `localhost:23020/t/<slug>/...` as a fallback; the router strips the prefix before resolution.

### 5.3 Mail addresses

Per-tenant Workspace domain (F44). Operational mailboxes become tenant-scoped:
- Tenant `wardian-toby`: `wardian@kanzen.family`, `accounts@kanzen.family`, etc.
- Tenant `lin-singapore`: `house@linfamily.sg`, etc.

The Directory (W9.4) already reads `mail_inboxes` per-tenant via the `tenant_id` predicate.

## 6. Migration plan (one commit per step)

### 6.1 Step 1 — V4_0_0
- Create `tenants` table.
- Insert default tenant with slug `default`.
- `alter table … add column tenant_id uuid references tenants(id);` for all domain tables.
- Backfill `tenant_id = <default>` for existing rows.
- **No code changes yet** — column is nullable, queries unchanged. CI is green.

### 6.2 Step 2 — V4_0_1
- NOT NULL the column on every domain table.
- Add composite indexes where they help.
- Still no code changes.

### 6.3 Step 3 — Principal.tenantId + Authz.tenantFilter
- Add `tenantId` to `Principal`. Default = the `<default>` tenant id for tokens without the claim.
- Add `tenantFilter` to `Authz`.
- A **`TenantNoLeakIT`** baseline test: create a second tenant, two assets (one per tenant), assert tenant A's principal sees only their asset across `/api/assets` + `/api/assets/<other-tenant-asset-id>` (must 404) + `/api/search` + `/api/insights` + every other listing endpoint. **This IT is the bar; it's exhaustive over endpoints and must stay green forever.**

### 6.4 Step 4 — Repo sweep
One commit per domain (mirrors F34 sweep order):
1. Assets
2. Tasks + Lists
3. Calendar
4. Inbox + comms (mail_inboxes / email_threads / entity_comments / entity_links)
5. Finance (bills, expenses, payments, reconciliation, ledger)
6. Properties + Bible
7. People + RBAC
8. Wealth
9. Documents + audit + notifications
10. Workspace integrations + tenants.settings

Each commit:
- Adds `Authz.tenantFilter(p)` to every read query in that domain.
- Inserts get `tenant_id = p.tenantId` automatically.
- The `TenantNoLeakIT` grows tests for that domain — never shrinks.

### 6.5 Step 5 — Tenant signup endpoint (the F46 prerequisite)
- `POST /api/tenants` (public, rate-limited): creates a `tenants` row + the principal user + invites them.
- See F46 for the full onboarding flow this kicks off.

## 7. Implications for already-shipped features

- The **F34 event taxonomy** (F34-event-instrumentation) is already getting a sweep — fold `tenant_id` into the `Envelope.subject` resolution path. Consumers filter by `tenant_id`.
- The **W9 collaborative inbox**'s `mail_inboxes` becomes tenant-scoped; the seeded "default" mailboxes belong to the `default` tenant only.
- The **F02v2 RBAC** stays per-tenant. Role inheritance + permission sets are scoped to a tenant. Roles can be templated across tenants but each tenant has its own copy.
- **Cognito** at W9.5 cutover gets a shared user pool with `custom:tenant_id` and `custom:tenant_slug` claims.
- **Search + NL + ⌘K** queries already filter by `Authz`; adding `tenantFilter` is a one-liner per endpoint.
- **Audit** stays per-tenant — audit log is scoped to a tenant's view.

## 8. Operator + cost implications

- **Single Postgres**, multi-tenant via row-level. RDS sizing scales with total data, not tenant count. ~10k tenants of household-sized data is comfortably under 100GB.
- **S3** buckets: shared with per-tenant prefix `s3://kanzen-blobs/<tenant-slug>/...`. Per-tenant lifecycle policies optional.
- **Cognito**: one user pool, `custom:tenant_id` enforced. ~$0.0055/MAU billable user.
- **Workspace integrations**: per-tenant — operator's responsibility, paid by tenant.

## 9. Risks + mitigations

- **A leak missed in the sweep.** Mitigated by the `TenantNoLeakIT` — every endpoint exercised under cross-tenant credentials. Adding a new endpoint without extending the IT is a forced failure (the test enumerates handlers and fails on uncovered ones).
- **Backfill of an enormous dataset.** Not an issue today (household-scale); add table-by-table backfill scripts when scaling.
- **Operator confusion managing tenants.** A `/admin/tenants` page (Kanzen-team-only, never customer-visible) listing tenants with last-active, plan, integration health. Out of scope for this spec — separate operator tooling.
- **Dev / E2E breakage** during the sweep. The `default` tenant + nullable migration path means existing tests survive; we only flip `NOT NULL` once every domain is swept.

## 10. Out of scope

- Schema-per-tenant. Already rejected (§2).
- A tenant-switching UI within a single browser session. Each tenant gets a separate subdomain; switching is "log out, log in elsewhere."
- Cross-tenant analytics for the platform operator. Separate read-only tool, not a Kanzen feature.
