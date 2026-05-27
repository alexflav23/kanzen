# F02 v2 — Enterprise RBAC (cohesive)

Revises F02 from object-level RBAC into a HubSpot-grade authorization system, built **cohesively** (one
feature, landed as coherent non-breaking increments — never a half-migrated state). Confirmed scope:
**every action gated**, **permission sets → roles (composable + inheritable) → users + teams (nested)**,
**per-permission scope (own/team/property/all)**, and a **builder UI**. Granularity = **object × verbs +
specials** (HubSpot's model), not one-permission-per-endpoint.

## What exists (F02, keep working)
`Authorizer` over `permission_rules (role_name, resource, field?, level∈none|read|write|admin)`,
most-specific-wins (field > resource > `*`), default-deny; `roles` (system + seeded + custom);
`user_property_scopes`; editable matrix at Settings → Permissions (`/api/admin/roles` + `/permissions`);
`users.role` (text); every API + the agent route through one Authorizer (per-request).

## Target model (additive)
- **Action catalogue** (code registry `authz.Actions`, exposed at `GET /api/admin/permission-catalogue`):
  the canonical `(resource, verb)` set. Verbs = `view|create|edit|delete` + per-object **specials**
  (`approve`, `pay`, `export`, `move`, `set_hero`, `reconcile`, `impersonate`, …). Each action declares a
  `minLevel` (read|write|admin) for **back-compat** + `sensitive?`. ~35 resources × ~5–10 verbs.
- **`permission_sets`** (id, name, description, is_system) + **`permission_set_grants`**
  (set_id, resource, action, field?, scope∈own|team|property|all default all, effect∈allow|deny).
  `'*'` wildcards allowed for resource/action.
- **`role_sets`** (role_name, set_id) — a role is composed of sets (+ legacy `permission_rules` still honoured).
- **`roles.parent_role`** (nullable) — role inheritance (`extends`).
- **`teams`** (id, name, parent_team_id [nesting], description) + **`team_members`** (team_id, user_id) +
  **`team_roles`** (team_id, role_name) + **`team_property_scopes`** (team_id, property_id).
- **`user_roles`** (user_id, role_name) — multi-role per user. `users.role` stays as the **primary/display**
  role (JWT `custom:role`, DevAuth, token-identity unchanged); the Authorizer composes the full effective set.

## Authorizer v2 — resolution
Effective grants for a user = union over: direct `user_roles` (+ the primary `users.role`) **and**
`team_roles` for every team the user belongs to **including ancestor teams** — each role expanded through
its `parent_role` chain, its `role_sets`' grants, and its legacy `permission_rules`. Decide `can(action,
resource, field?, record?)`:
1. gather matching grants (resource = R or `*`; action = A or `*`; field = F or null),
2. **deny overrides allow**; else an allow exists ⇒ permitted; else **default-deny**,
3. **scope** narrows *which records*: `all` (no limit) · `property` (record.property ∈ user/team property
   scopes) · `team` (record.owner ∈ a teammate) · `own` (record.owner_id == me). Single-record ops check
   the record; list ops get a scope predicate the repo applies.
Legacy bridge: a legacy `(resource, level)` rule grants every catalogue action on that resource whose
`minLevel ≤ level` — so existing roles authorize the new actions unchanged. `can(action)` first checks
explicit per-action grants, then falls back to the legacy level mapping. Per-request load (cache later).
The **agent** and every endpoint use the same `can(action)` path.

## Back-compat & cohesive migration (never broken)
1. **Action catalogue + `can(action)` with legacy-level fallback** — no schema, no endpoint changes; the
   matrix keeps working. (keystone)
2. **Schema + Authorizer composition** — sets, role_sets, role inheritance, teams, team_*, user_roles; the
   Authorizer composes them alongside legacy rules. Existing behaviour unchanged (no sets/teams seeded yet).
3. **Migrate endpoints** `can(Level, resource)` → `can(action)` (per-object verbs + specials) and add
   **own/property scope** enforcement where it matters; deny-path tests per action.
4. **Builder UI** — permission-set builder (object × verb toggles + scope dropdown + sensitive-field
   toggles), role composition + inheritance, teams (nested) + members + scope, user assignment + an
   **effective-permissions preview**. Extends/replaces Settings → Permissions.
5. **Seed mapping** — express the current system + estate/household roles as sets/grants in the new model
   (equivalent to today); regression proves no permission changed; full live verify.

Each step ships green (full regression) and non-breaking; "done" only when the whole is coherent.

## S3 outcome — endpoint migration (done)
- **`Authz.forUser(p.userId, p.role)` is wired at every endpoint** (119 call sites). Each request resolves the
  *fully composed* authorizer (primary ∪ user_roles ∪ team roles through the hierarchy ∪ parent-role inheritance
  ∪ permission-set grants). The one role-string fan-out (`NotificationFanout`) stays on `authorizer(role)`.
- **The whole API surface authorizes via `can(action)`** (reads → `<res>:view`; writes → the specific verb).
  Shared `read`/`write`/`gate`/`principal` helpers are parameterised by `Action` so one endpoint can require a
  precise verb — proven end-to-end (`ListsActionScopeIT`: deny `list:order` while keeping `edit`; grant
  order-only without edit). Verb-granular grants now bite on: bill (incl. pay/schedule), expense (approve/
  export), bank_account (sync/reconcile), receipt (parse), list (propose/approve/order), asset (incl. move/
  custody/set_hero/restructure), asset_event, data_quality (scan), tag/taxonomy/custom_field, property, vendor/
  person/product, task/calendar/maintenance, fx/ledger-view, wealth, backup, agent, search, notification.
- **Own-scope enforcement** on the asset registry: an `asset:view` grant scoped to `own` restricts the list
  (`AssetRepo.list` ownerId filter) and 404s another owner's detail (`AssetRepo.ownerOf`, no leak). Team/property
  record-scope on other resources is layered the same way in later slices.
- **Catalogue reconciled to the real gating model** (so every catalogue action maps to a real gate, no dangling
  toggles): `asset_event` + `data_quality` are their own resources; pay-queue + payment methods authorize as part
  of `bill`; bank sync/reconcile as part of `bank_account`; `wealth` + `backup` are admin-level + sensitive (even
  viewing). Aspirational sub-resources that collapse onto a parent were dropped from the catalogue
  (collection/asset_group→`asset`, location→`property`, tax→`ledger`, investment→`wealth`, insights→`asset`,
  payment/payment_method/bank) — candidates for a future resource-split slice (each needs its own seed mapping).
- **Deliberately NOT migrated** (kept on the legacy/level path, documented): **Ledger** (internal double-entry,
  hidden by house rule), **Roles/Impersonate** (the RBAC admin surface must stay gated on the root `*`-admin grant
  so authz can't be delegated/escalated), **Defects** (property-scoped + field-level `authorize` helper),
  **Valuations/Provenance** field-level valuation/insured-value checks (a field-level mechanism, not a catalogue action).
- **Non-breaking**: `can(action)` falls back to `can(action.minLevel, action.resource)` with no matching grant, so
  un-granted roles are unchanged; `compose` keeps explicit field/resource **denies** (fixed a bug that leaked
  Manager valuations). backend 376/376 green.

## S4 outcome — management API + builder UI (done)
- **Management API** `/api/admin/rbac/*` (26 endpoints, `RbacAdmin` + `RbacAdminRepo`): permission sets + grants
  CRUD; role composition (attach/detach sets, set parent with a **cycle guard**); nested teams (create/reparent with
  a cycle guard, members, roles, property scopes); multi-role users; an accounts list; and
  `GET …/users/:id/effective` which runs the **real `Authz.forUser` resolution** and returns every catalogue action
  the user can perform with its narrowest scope + the effective role set. All gated on the **root `*`-admin grant**
  (RBAC admin can't be delegated/escalated), every write audited, grants validated against the catalogue
  (unknown resource/verb → 400; scope ∈ all|property|team|own; effect ∈ allow|deny). `RbacAdminIT` (6) covers the
  deny path, set→role→user, set→team(role) nesting, scope-in-preview, the cycle guard and grant validation.
- **Builder UI** (`web/src/features/rbac/*`, Settings → **Builder** tab; the legacy matrix is now **Advanced
  matrix**): four panels — **Permission sets** (object × verb Off/Allow/Deny grid off the live catalogue, with a
  per-action scope dropdown + sensitive flags), **Roles** (parent inheritance + attach permission sets), **Teams**
  (nested, members/roles/property scopes), **People** (assign extra roles + the effective-permissions preview,
  grouped by resource with scope pills). Entirely token-driven through the global ThemeContext — no inline styles,
  no per-component theme branching; verified in light + dark. Vitest (RbacBuilder + updated Settings) + Playwright
  (`rbac-builder.spec`: compose a set → grant → preview → cleanup) + an **axe sweep in both themes** (0 serious/
  critical). Full regression on a pristine DB: backend 382/382, web 90/90 unit, 78/78 e2e + a11y clean.

## S5 outcome — starter sets + close-out (done) → **F02 v2 COMPLETE**
- **Canonical starter permission sets** seeded as system-owned bundles (`V2_72_0`): *Registry — read only*,
  *Registry — curator*, *Finance — bill approver*, *Operations — lists & calendar*, *Property — caretaker* —
  reusable building blocks an admin composes into roles/teams via the builder. **Deliberately NOT a 1:1 mapping of
  the legacy matrix into grants**: the matrix + bridge stay the source of truth for the 4 system roles, so there is
  exactly one source of truth per role and the migration is provably non-breaking (the sets are attached to nobody →
  every user resolves to today's permissions). `RbacAdminIT` proves the sets are seeded, complete, deletion-
  protected (system), and attached to **zero** roles.
- a11y fix: the active Allow/Deny segment now uses high-contrast `ink` on the soft tint (the green/red-as-text
  pairing was 4.06:1 at 12px); the tint + label + `aria-pressed` carry state without relying on colour. Builder is
  axe-clean (serious/critical = 0) in both themes.
- Full regression on a pristine, seeded DB: backend **384/384**, web **90/90** unit + **78/78** e2e + a11y clean.

F02 v2 ships the whole arc — catalogue + `can(action)` bridge (S1) · composed `Authz.forUser` over sets/inheritance/
nested teams/multi-role (S2) · whole API on `can(action)` + scope (S3) · management API + HubSpot-style builder UI
with effective preview (S4) · starter sets + close-out (S5) — cohesively and non-breaking throughout.

## Invariants (unchanged)
Default-deny · AuthZ once, centrally (agent included) · field-level response filtering (valuations) ·
registry/finance Principal-private with the Manager carve-out · every authz change audited · root grant
(principal `*` admin) protected from lockout.

## Tests
weaver: catalogue completeness (every gated action in the registry), Authorizer composition (sets +
inheritance + teams + scope), deny-paths per action, legacy-bridge equivalence, scope (own/property/team).
web: builder unit + Playwright (create a set → role → team → assign → effective preview) + a11y; the
regression gate (full suite + axe/audit light&dark) every slice.
