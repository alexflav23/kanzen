# Feature F02 — Authorization: policy engine, custom roles & property scope

| | |
|---|---|
| **Feature ID** | F02 |
| **Milestone** | M1 |
| **Domain** | Identity |
| **Status** | ✅ spec complete |
| **Depends on** | F01 |
| **Spec references** | SPEC §4, §13; `input/views/stubs.jsx` (`PermissionsMatrix`) |

> **Decisions (this feature):** **full resource/field-level RBAC** (a general policy engine, not just a module matrix) and **Principal-definable custom roles** (the four spec roles ship as seeded, editable defaults). Levels remain **none/read/write/admin**. Property scope is an **independent dimension**.

---

## 1. Purpose & user value
A precise, auditable authorization layer that lets the Principal grant exactly the right access — down to individual sensitive fields (the Manager can run operational Finance but never see valuations, the ledger, or bank balances) — and define new roles as the household evolves. Enforced identically for humans and the email agent, server-side, default-deny. This is the guarantee behind "the registry is Principal-private."

## 2. Roles & permissions
- **Principal** (or any role with `admin` on the `settings.permissions` resource): create/edit/delete roles, edit permission rules, assign roles + property scope to users.
- **Everyone**: may read **their own** effective permissions (`GET /api/me/permissions`) so the UI can hide/disable what they can't do.
- **Self-lockout guard**: an admin cannot remove the last `admin`-on-`settings.permissions` grant from the system, nor strip their own admin in a way that leaves no administrator.

## 3. Data model
`V1_2_0__authz.sql` (and alters F01's `users`):

- **`roles`** — `id uuid pk`, `name text unique`, `description text`, `is_system bool` (the four seeded roles), `created_by uuid`, `created_at`, `updated_at`, `deleted_at null`.
- **`permission_rules`** — `id uuid pk`, `role_id uuid → roles`, `resource text`, `field text null` (null = resource-level; non-null = field-level override), `level text check ('none','read','write','admin')`, `updated_at`. Unique `(role_id, resource, field)`.
- **`users`** alter: add `role_id uuid → roles` (backfill from F01's `users.role` text by name, then keep `role` as a denormalised label or drop). Add `property_scope text check ('all','scoped') default 'all'`.
- **`property_scopes`** (from F00 scaffold) — `(id, user_id → users, property_id → properties)`. Rows present only when `property_scope = 'scoped'`.
- **Resource catalog** (code-level, exposed via API for the UI; optionally a `resources` reference table): the protected resource types, each with `module` (nav group), optional `parent`, and a list of **sensitive fields**. Examples:
  - `asset` (module Inventory) — sensitive fields: `market_value`, `insured_value`, `valuation_snapshots`.
  - `bank_account` — sensitive field: `balance`; `bank_transaction`; `ledger` (module Finance, sensitive whole-resource); `payment_method` (field: `last4`).
  - plus `collection`, `receipt`, `bill`, `bill_payment`, `budget`, `approval`, `expense`, `document`, `property`, `room`, `vendor`, `person`, `employment_record`, `list`, `task`, `calendar`, `maintenance`, `inbox`, `insights`, `backup`, `settings`, `settings.permissions`, `audit`, `user`.

### Seeded default roles (as rule sets)
- **Principal** — `admin` on `*` (all resources + sensitive fields).
- **Manager** — `write` on operational resources (`property`, `room`, `asset`, `receipt`, `document`, `bill`, `bill_payment`, `vendor`, `person` [minus private docs], `list`, `maintenance`, `inbox`, `reconciliation`); **field-deny** (`none`) on `asset.market_value`, `asset.insured_value`, `asset.valuation_snapshots`, `bank_account.balance`; `none` on `ledger`, `budget` read-only, `insights`, `backup`, `settings.permissions`.
- **Staff** — `write` on own `task` + `list` (propose), raise `inbox` issues; `read` on assigned-property `property`/`room` basics; `none` on registry/finance.
- **Property-scoped Manager** — clone of Manager with `property_scope = scoped`; per-grant registry access via rule edits.

## 4. API (Tapir endpoints)
- `GET /api/permissions/resources` — the resource catalog (resources, modules, fields) for the matrix UI.
- `GET /api/permissions/roles` · `POST /api/permissions/roles` (custom) · `PATCH /api/permissions/roles/:id` · `DELETE /api/permissions/roles/:id` (blocked if assigned — must reassign first; system roles cannot be deleted).
- `GET /api/permissions/rules?role=:id` · `PUT /api/permissions/rules` (bulk-save a role's matrix + field overrides; the prototype's Save).
- `POST /api/users/:id/role` · `POST /api/users/:id/scope` (assign role / set `all`|`scoped` + property list) — or via F01's `PATCH /api/users/:id`.
- `GET /api/me/permissions` — the caller's **effective** permission set (resource→level + field denials + scope), for UI gating.

## 5. UI / screens & states
Extends the prototype's `PermissionsMatrix` (Settings → Permissions):
- **Matrix**: modules grouped (as today) → rows are resources; columns are **roles** (incl. an **"+ Add role"** column). Each cell shows the resource-level level (click to cycle none→read→write→admin). A cell with field-overrides shows a small indicator; expanding the row reveals **field rules** (e.g. `asset.market_value`) editable independently.
- **States**: clean / unsaved-changes (count + Save/Reset, as prototype) / saving / error. Legend explains the four levels + the property-scope note (already in the prototype).
- **Role management**: create/rename/describe/delete custom roles; system roles are read-only-name. Deleting a role in use prompts to reassign its users.
- **User assignment** (Settings → People, with F01): set a user's role + property scope (`all` or pick properties).

## 6. Business rules & validation
- **Default deny.** No matching rule → `none`.
- **Most-specific wins.** Field rule overrides resource rule; resource rule overrides parent/module rule.
- **Property scope is independent.** Effective access to an *instance* requires (a) the rule allows the action on the resource/field **and** (b) the instance's `property_id` ∈ the user's scope (or scope = `all`, or the resource is non-property-bound). Registry/finance instances additionally honour `owner_id` (Principal-private) unless a rule grants the role.
- **Field-level read filtering.** Responses are passed through a permission-aware serializer that strips fields the principal cannot `read` (e.g. an Asset returned to a Manager omits `market_value`/`insured_value`/`valuation_snapshots`). Writes to denied fields are rejected.
- **`write` implies `read`; `admin` implies `write` + delete.**
- **Agent principal.** The email agent runs as a `system` principal bound to an **Agent role** (seeded) and goes through the *same* `Authorizer`; financial auto-execute remains blocked at the agent layer (F27) regardless.
- **Self-lockout guard** (see §2).
- **Audit** every role create/edit/delete, rule change, and assignment.

## 7. Integrations / external systems
- **Cognito `PreTokenGeneration`** (from F01) injects `role_id` (and optionally a small scope hint) into the JWT so the backend can resolve permissions without an extra round-trip; the DB remains the source of truth (rules can change mid-token, so enforcement re-reads rules, cached briefly).
- No external systems beyond Cognito.

## 8. Edge cases
- **Rule change mid-session** → enforcement re-reads current rules (short TTL cache); the affected user's next request reflects it; no stale-permission writes.
- **Custom role deleted while assigned** → blocked; must reassign users first.
- **Field denied but needed by an aggregate** (Insights sums valuations) → aggregates run under the *requesting* principal; a Manager's Insights excludes denied dimensions or 403s the valuation widgets (don't leak via totals).
- **Scoped user querying a global (no-property) record** → allowed only if a rule grants it; property filter skipped for non-property-bound resources.
- **Conflicting rules at same specificity** → deterministic precedence (deny > admin > write > read) to fail safe.
- **Last administrator** → cannot be demoted/suspended (guard + clear error).
- **New resource/field added by a later feature** → defaults to `none` for all non-Principal roles until a rule is added (safe-by-default); migration adds the catalog entry.

## 9. Acceptance criteria
- **AC1** A Manager calling `GET /api/assets/:id` receives the asset **without** `market_value`, `insured_value`, or `valuation_snapshots`; a Principal receives them.
- **AC2** A Manager is denied (`403`) on `GET /api/ledger/*`, bank balances, and `settings.permissions`.
- **AC3** The Principal creates a custom role "Singapore Lead", grants it Manager-like rules scoped to the Singapore property, assigns Siti's future replacement; that user sees only Singapore data.
- **AC4** A Staff user (Marcia) can create a Wardian list item and a task, but `GET /api/inventory` returns `403`.
- **AC5** Editing a rule takes effect on the target user's next request (no re-login needed).
- **AC6** Attempting to remove the last admin grant is rejected.
- **AC7** `GET /api/me/permissions` returns an effective set the web app uses to hide the Inventory/Finance nav for Staff.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG): the `Authorizer` truth table (resource/field/level/scope/owner combinations); field-strip serializer (asset for Manager vs Principal); scope filtering (Singapore-scoped user can't read Wardian); default-deny for an unknown resource; precedence/conflict resolution; self-lockout guard; agent-principal path.
- **Web**: Vitest for permission-driven nav/widget gating from `GET /api/me/permissions`; Playwright e2e signing in as Manager vs Principal and asserting the valuation widgets are absent for Manager.
- **Security**: explicit "no leak via aggregates" test; write-to-denied-field rejection.

## 11. Observability & audit
- Audit: role CRUD, rule changes (before/after), role/scope assignments, and **authorization denials** (sampled) for anomaly detection.
- Metrics: denial rate by resource, rule-cache hit rate, per-role active users.
- The `audit_log_entries` (F00) records the actor + change detail; the audit view (Settings) is itself behind `audit:read`.

## 12. Open questions / decisions
1. **One role per user vs multiple** — assumed **one role + property scope** per user. Allow multiple roles (union of grants) if a person wears two hats?
2. **Scope shape** — per-user property list (assumed) vs per-assignment (a user could have role A on Wardian and role B on Singapore). The latter needs a `user_role_scope` join.
3. **Rule-cache TTL** — how fresh must permission changes be (e.g. 30s cache) vs strictly per-request DB read.
4. **Aggregate leakage policy** — confirm Manager-facing Insights *omit* denied dimensions vs *403 the whole widget*.
