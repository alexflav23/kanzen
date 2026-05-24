# Feature F42 — Legal entities, books & structures

| | |
|---|---|
| **Feature ID** | F42 |
| **Milestone** | Wave G (Private Wealth) |
| **Domain** | Private Wealth |
| **Status** | spec complete |
| **Depends on** | F02 (RBAC — entity scope dimension), F18 (TigerBeetle ledger), F37 (FX + base currency per entity) |
| **Spec references** | GnuCash multi-book model (`libgnucash/engine`); the implementation plan (multi-entity/multi-book locked decisions) |

> **Decisions:** `entity` is a **first-class scoping dimension** across the entire accounting core — every downstream account, transaction/split, and TigerBeetle posting carries an `entity_id`. Each entity (personal / trust / company / SPV / partnership) keeps its own **book/ledger**, with a **base currency** and independent **accounting periods**; year-end close seals a period and blocks further postings into it. F02 RBAC gains an **entity scope** dimension (alongside property scope): Principal-private by default; no Manager carve-out for wealth/entity data. **Consolidation** rolls child entities up to a group net worth with intercompany elimination; the elimination is a computed view, never a ledger mutation. **Circular ownership is rejected at write time.** The TigerBeetle ledger remains hidden in the UI (F18 invariant holds per entity). **Financial and entity creation are always proposed, never auto-committed (F27).** This feature is **foundational**: F39, F40, F41, and F43 all extend it — land F42 first in Wave G.

---

## 1. Purpose & user value

A UHNWI individual does not hold wealth as one undifferentiated mass. Assets sit in trusts, companies, SPVs, partnerships and personal names across multiple jurisdictions. Today those "books" are separate spreadsheets, accountant files or GnuCash databases with no bridge between them.

F42 gives the Principal a single, coherent model of every legal vehicle they control — with each entity keeping its own rigorous double-entry books (posted to TigerBeetle), its own base currency and accounting periods, and with ownership/holding relationships captured in a graph so the full consolidated picture (net worth, balance sheet, P&L) can be computed in F41/F43. It is the spine on which the rest of the Private Wealth module hangs.

Practical outcomes: see every entity you control, understand the ownership chain, know which period is open for each book, close a year-end cleanly and block stale postings, and roll a consolidated view across the whole structure.

## 2. Roles & permissions

**Principal-private.** Entity/wealth data is never exposed to Manager, Staff or the Agent for reading or writing, except as explicitly noted.

| Actor | Resource `entity` | Resource `entity_ownership` | Resource `accounting_period` | Resource `consolidation_group` |
|---|---|---|---|---|
| **Principal (Toby)** | `admin` | `admin` | `admin` | `admin` |
| **Manager (Lorna)** | `none` | `none` | `none` | `none` |
| **Staff (Marcia / Siti)** | `none` | `none` | `none` | `none` |
| **The Agent** | propose only (never auto-commits) | propose only | `none` | `none` |

F02's `Authorizer` gains an **entity scope** dimension alongside property scope: a user can be scoped to a subset of entities (e.g. operational access to just one company book), but the default for all non-Principal roles is `none`. Entity scope and property scope are **independent dimensions** — effective access requires both checks to pass.

The entity scope extension to F02:

- `entity_scopes` table: `(user_id, entity_id)` — rows present only when a user has been explicitly granted scoped entity access.
- `Authorizer.checkEntity(principal, entityId, resource, level)` follows the same logic as `checkProperty`; both must pass for any entity-scoped resource access.
- `GET /api/me/permissions` returns effective entity scope alongside property scope.

## 3. Data model

`V__entities.sql`:

```sql
-- Entity kinds
CREATE TYPE entity_kind AS ENUM (
  'personal', 'trust', 'company', 'spv', 'partnership'
);

-- Entity status
CREATE TYPE entity_status AS ENUM (
  'active', 'dormant', 'dissolved', 'proposed'
);

-- Accounting period status
CREATE TYPE period_status AS ENUM (
  'open', 'closing', 'closed'
);

-- Core entity table
CREATE TABLE entities (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid        NOT NULL REFERENCES users(id),
  name               text        NOT NULL,
  kind               entity_kind NOT NULL,
  jurisdiction       text        NOT NULL,          -- ISO 3166-1 alpha-2 country code
  base_currency      text        NOT NULL,          -- ISO 4217; default GBP
  parent_entity_id   uuid        REFERENCES entities(id),  -- direct parent in the holding graph
  description        text,
  registration_ref   text,                          -- company number / trust deed ref / etc.
  status             entity_status NOT NULL DEFAULT 'active',
  settings           jsonb        NOT NULL DEFAULT '{}',  -- future extensibility
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now(),
  deleted_at         timestamptz                    -- soft-delete
);

-- Ownership / holding graph (can express multi-parent and beneficial ownership)
CREATE TABLE entity_ownership (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            uuid         NOT NULL REFERENCES users(id),
  parent_entity_id    uuid         NOT NULL REFERENCES entities(id),
  child_entity_id     uuid         NOT NULL REFERENCES entities(id),
  pct                 numeric(7,4) NOT NULL CHECK (pct > 0 AND pct <= 100),
  beneficial          bool         NOT NULL DEFAULT false,  -- beneficial owner flag
  effective_from      date         NOT NULL DEFAULT CURRENT_DATE,
  effective_to        date,                                 -- null = current
  note                text,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (parent_entity_id, child_entity_id, effective_from),
  CHECK (parent_entity_id <> child_entity_id)               -- direct self-loop rejected
);

-- Accounting periods (one per entity per period label)
CREATE TABLE accounting_periods (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid          NOT NULL REFERENCES users(id),
  entity_id     uuid          NOT NULL REFERENCES entities(id),
  period_label  text          NOT NULL,   -- e.g. '2025/26', 'FY2025', 'Q1-2026'
  starts_on     date          NOT NULL,
  ends_on       date          NOT NULL,
  status        period_status NOT NULL DEFAULT 'open',
  closed_at     timestamptz,
  closed_by     uuid          REFERENCES users(id),
  closing_note  text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (entity_id, period_label),
  CHECK (ends_on > starts_on)
);

-- Consolidation groups (one principal can have multiple groups, e.g. "UK Group", "Asia Group")
CREATE TABLE consolidation_groups (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES users(id),
  name        text        NOT NULL,
  description text,
  base_currency text      NOT NULL,   -- target currency for consolidated view
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Members of a consolidation group
CREATE TABLE consolidation_group_members (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               uuid        NOT NULL REFERENCES users(id),
  consolidation_group_id uuid        NOT NULL REFERENCES consolidation_groups(id),
  entity_id              uuid        NOT NULL REFERENCES entities(id),
  is_parent              bool        NOT NULL DEFAULT false,  -- true for the top-level reporting entity
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consolidation_group_id, entity_id)
);

-- Entity scope grants for non-Principal users (extends F02)
CREATE TABLE entity_scopes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES users(id),
  entity_id  uuid        NOT NULL REFERENCES entities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_id)
);

-- Indexes
CREATE INDEX ON entities (owner_id) WHERE deleted_at IS NULL;
CREATE INDEX ON entities (parent_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX ON entity_ownership (parent_entity_id, effective_to) WHERE deleted_at IS NULL;
CREATE INDEX ON entity_ownership (child_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX ON accounting_periods (entity_id, status);
CREATE INDEX ON consolidation_group_members (consolidation_group_id);
```

**Entity-scoping on downstream tables** — every table introduced by F39/F40/F41/F43 (accounts, splits, postings) carries:

```sql
entity_id  uuid  NOT NULL REFERENCES entities(id)
```

This is the locked multi-book invariant (per the implementation plan). Postgres foreign keys + application-layer `Authorizer.checkEntity` enforce it.

**Money convention:** all amounts in minor integer units + ISO currency column; cross-entity/cross-currency consolidation normalized via F37. No floats.

**Seeded entities** (alongside the real properties seed):

| Name | Kind | Jurisdiction | Base currency |
|---|---|---|---|
| Toby (personal) | personal | GB | GBP |
| Singapore Personal | personal | SG | SGD |

Additional trust/company/SPV entities are Principal-defined at runtime.

## 4. API (Tapir endpoints)

All endpoints are **Principal-only** (enforced at the Tapir security layer → `Authorizer.checkEntity`). OpenAPI documented at `/docs`.

### Entities

| Method + path | Description |
|---|---|
| `GET /api/entities` | List all entities for the authenticated Principal (active, including soft-deleted if `?include_deleted=true`) |
| `POST /api/entities` | Create a new entity (proposed state; Principal confirms, per F27 invariant for financial creation) |
| `GET /api/entities/:id` | Entity detail + ownership edges |
| `PATCH /api/entities/:id` | Update name / description / jurisdiction / base currency / status |
| `DELETE /api/entities/:id` | Soft-delete (sets `deleted_at`; blocked if open accounting periods exist) |

### Ownership graph

| Method + path | Description |
|---|---|
| `GET /api/entities/:id/ownership` | Ownership edges where this entity is parent or child (with `beneficial` flag, `pct`, effectivity) |
| `POST /api/entities/:id/ownership` | Add an ownership edge; server-side cycle detection rejects circular ownership |
| `PATCH /api/entity-ownership/:id` | Update `pct`, `beneficial`, `effective_to` |
| `DELETE /api/entity-ownership/:id` | Soft-delete an ownership edge |
| `GET /api/entities/:id/holding-graph` | Full transitive holding graph (depth-limited BFS); includes `beneficial_pct` rollup |

### Accounting periods

| Method + path | Description |
|---|---|
| `GET /api/entities/:id/periods` | List periods for an entity |
| `POST /api/entities/:id/periods` | Open a new accounting period (requires no overlapping open period) |
| `POST /api/entities/:id/periods/:pid/close` | Initiate year-end close (sets `closing`; finalizes to `closed` after validation checks) |
| `GET /api/entities/:id/periods/current` | The currently open period for this entity |

### Consolidation groups

| Method + path | Description |
|---|---|
| `GET /api/consolidation-groups` | List Principal's consolidation groups |
| `POST /api/consolidation-groups` | Create a group with a name and base currency |
| `PATCH /api/consolidation-groups/:id` | Update name / base currency |
| `POST /api/consolidation-groups/:id/members` | Add an entity to the group |
| `DELETE /api/consolidation-groups/:id/members/:eid` | Remove entity from group |
| `GET /api/consolidation-groups/:id/net-worth` | Consolidated net-worth view (children rolled up, intercompany eliminated, FX-normalized); delegated to F41/F43 |

### Entity scope (F02 extension)

`POST /api/users/:uid/entity-scope` · `DELETE /api/users/:uid/entity-scope/:eid` — assign / revoke entity scope for a non-Principal user (Principal-only operation).

## 5. UI / screens & states

### Entities list screen (`/wealth/entities`)

A top-level screen under a new **Wealth** nav section (Principal-only; hidden from all other roles via `GET /api/me/permissions`).

- **Entities table**: name · kind (Pill: personal / trust / company / SPV / partnership) · jurisdiction · base currency · status · open period label · action menu.
- **+ New entity** button → slide-over / modal (name, kind, jurisdiction, base currency; proposal state per F27).
- States: loading skeleton · empty (no entities — seed tiles visible) · error · **forbidden** (non-Principal sees 403-empty with no data).

### Entity detail screen (`/wealth/entities/:id`)

Tabs:
1. **Overview** — MetaGrid: kind, jurisdiction, registration ref, base currency, status; description; open/recent accounting periods.
2. **Ownership** — interactive holding graph (parent + children with `pct` and `beneficial` labels); beneficiaries listed; **+ Add ownership** action.
3. **Periods** — table of accounting periods with status badge (open / closing / closed), dates, closed-by; **Open new period** and **Close period** actions.
4. **Books** — entry point into F39 (chart of accounts + transactions for this entity); stub in F42, populated by F39.
5. **Consolidation** — which groups include this entity; link to consolidated view (F41/F43).

States per tab: loading · empty · error · period-closed warning (read-only view).

### Holding graph visualisation

Lightweight SVG/Canvas tree (not a full force-directed graph): nodes are entity Pill cards (name + kind), edges labelled with `pct%` + `beneficial` flag. Toby sees his full structure at a glance. Depth limited to 5 levels for rendering; deeper graphs collapse with a "show more" node.

### Consolidation group screen (`/wealth/consolidation`)

List of groups → group detail: member entities, consolidated base currency, and a **Consolidated net worth** tile (placeholder in F42; wired in F41/F43).

### Agent ribbon

The Agent may propose a new entity (e.g. when parsing a company incorporation document). The proposal surfaces in Triage (F26) with the entity detail pre-filled; the Principal confirms — never auto-committed.

### Design tokens

Follows the warm-paper light/dark design language. Wealth nav section: new icon (e.g. a building / structure glyph). Entity kind Pill colours: `personal` → indigo; `trust` → amber; `company` → sky; `spv` → violet; `partnership` → teal. Period status badges: `open` → green; `closing` → amber; `closed` → slate.

## 6. Business rules & validation

### Entity rules

- `name` + `kind` + `jurisdiction` + `base_currency` are required at creation.
- `base_currency` must be a valid active ISO 4217 code (join `currencies`, F37).
- `parent_entity_id` is a convenience direct-parent pointer; the full holding graph is expressed via `entity_ownership`; both must be consistent (migration/update validates).
- Soft-delete is blocked if the entity has an **open accounting period** or is the `parent_entity_id` of any non-deleted entity — must close/reassign first.
- Status transitions: `proposed → active`; `active → dormant`; `active | dormant → dissolved`; no resurrection of `dissolved`.

### Ownership graph rules

- **No circular ownership.** Before inserting `entity_ownership(parent, child)`, the server performs a depth-first traversal of existing edges to assert that `child` does not already reach `parent` transitively. Circular chains (A → B → C → A) are rejected with a clear error. Enforced in the Scala domain layer (not just a DB check), tested with a FreeSpec.
- `pct` values per parent may sum to > 100% (multiple minority shareholders are valid) but each individual edge `pct` must be in (0, 100].
- `effective_to` null = current; closed edges are preserved for history.
- Beneficial ownership (`beneficial = true`) denotes the UBO chain; Kanzen records it but makes no regulatory filing (consistent with "never moves money / never files").

### Accounting period rules

- **At most one open period per entity at a time.** Attempting to open a second period while one is already `open` or `closing` is rejected.
- Periods must not overlap (`starts_on`/`ends_on` checked against existing periods for the entity).
- **Closing sequence:** `open → closing` (initiates validation) → `closed` (finalized). Once `closed`, the period is immutable.
- **Postings into a closed period are blocked.** The posting pipeline (F18/F39) checks the period covering the posting date; if `status = closed`, the write is rejected with error `PERIOD_CLOSED`. This check is enforced in the Scala service layer for every downstream write (F39 accounts, F40 trades, F41 liability postings).
- A closing can be **rolled back** to `open` before it reaches `closed`, but only by the Principal.
- `closed_by` + `closed_at` + `closing_note` are required when transitioning to `closed`.

### Consolidation rules

- Consolidation is a **computed view**, never a ledger mutation. Intercompany elimination (eliminating receivable/payable pairs between consolidated entities) is computed at query time by the consolidation service; no new postings are created.
- Consolidation requires all member entities' balances to be FX-normalized to the group's `base_currency` via F37's stored transaction-date rates.
- An entity may belong to multiple consolidation groups.
- The `is_parent` flag marks the top reporting entity in a group; there can be at most one per group.
- **Closed-period figures** are used for year-end consolidated statements; the consolidation query accepts a `?as_of_date=` parameter to snapshot a consistent view.

### Multi-book invariant

Every downstream domain record that is entity-scoped carries `entity_id` as a non-nullable FK. Writes without `entity_id` are rejected at the API layer. The `Authorizer.checkEntity` call gates every such write and read.

### Agent rules

The Agent (F25/F27) may propose entity creation or ownership edge addition. These proposals appear in Triage; the Principal confirms. The Agent never directly inserts into `entities`, `entity_ownership`, or `accounting_periods`.

## 7. Integrations / external systems

- **F18 (TigerBeetle):** each entity maps to a distinct TB account namespace (or a label prefix per entity in a shared cluster). Postings are entity-scoped; the period-closed check gates TB writes. The TB ledger remains hidden in the UI.
- **F37 (FX):** each entity's `base_currency` is used as the per-entity reporting currency for period P&L and balance sheets; consolidation normalizes to the group `base_currency` using stored transaction-date rates.
- **F02 (RBAC):** the entity scope dimension extends F02's `Authorizer`. `entity_scopes` is provisioned here; the `Authorizer` code is extended in this feature.
- **F39 (Chart of Accounts):** F39 introduces typed account hierarchies per entity; each account carries `entity_id`. F42 provides the entity model F39 depends on — F42 lands first.
- **F41 / F43 (Net worth / Financial statements):** consume `consolidation_groups` and `accounting_periods` from F42 to produce per-entity and consolidated statements.
- **F26 (Triage):** Agent proposals for entity creation surface here.
- **F00 (Audit log):** all writes to `entities`, `entity_ownership`, `accounting_periods`, `consolidation_groups` are recorded in `audit_log_entries`.

No external system integrations. No regulatory filings; Kanzen records structure for the Principal's own intelligence only.

## 8. Edge cases

### Circular ownership

A → B → C and then `POST /api/entities/C/ownership` with `child_entity_id = A` must be **rejected** with error `CIRCULAR_OWNERSHIP`. The cycle detection traverses `entity_ownership` edges upward from the proposed parent; the depth limit for the traversal is set high enough to cover realistic structures (e.g. 20 hops) but bounded to prevent pathological inputs. Tested with FreeSpec with a known 3- and 5-node cycle.

### Posting into a closed period

A downstream write (F39/F40/F41) that carries a `posted_at` date falling within a `closed` period must return `422 PERIOD_CLOSED` with the period label in the error detail. The domain write does not succeed. This is tested end-to-end in `AccountingPeriodClosedIT`.

### Intercompany elimination on consolidation

If entity A has a `receivable` from entity B and B has a matching `payable` to A, the consolidation service eliminates these as offsetting entries in the consolidated view. The elimination logic uses account type (`intercompany_receivable` / `intercompany_payable`) markers set by F39; the consolidated net-worth figure is never inflated by intra-group balances.

### Per-entity base currency + FX consolidation

Each entity operates in its own `base_currency`. When rolling up to a consolidation group with a different `base_currency` (e.g. a SGD SPV into a GBP group), balances are converted using F37's stored rate at the period-end date (`as_of_date`). If rates are missing for the period-end date, the nearest-prior rate is used and flagged (consistent with F37 §8).

### Overlapping periods

Attempting to open a period whose `starts_on`/`ends_on` overlaps an existing period for the same entity is rejected with `PERIOD_OVERLAP`. Non-contiguous gaps between periods are allowed (an entity may have gaps in its accounting history).

### Dissolving an entity with open period

Attempting to set `status = dissolved` on an entity with an `open` or `closing` period is rejected. The Principal must close the period first.

### Ownership edge with zero or excessive pct

`pct = 0` or `pct > 100` on a single edge is rejected at the API layer (DB `CHECK` constraint + Tapir validation). Ownership across multiple parents summing to > 100% for a child is allowed (minority / joint arrangements) but the UI flags it.

### Deleting an entity that is a parent

Soft-delete of an entity referenced as `parent_entity_id` in a non-deleted `entities` row is blocked. The Principal must reassign or dissolve child entities first.

## 9. Acceptance scenarios (UAT)

Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Create and list entities**  ‹maps: `EntityCrudIT`, web `entities.spec` create-list›
- **Given** Toby is authenticated and has no entities beyond the seeded personal ones
- **When** he creates a new entity (name="Wardian Holdings Ltd", kind=`company`, jurisdiction=`GB`, base_currency=`GBP`) via `POST /api/entities`
- **Then** the entity is created with `status=active`; `GET /api/entities` returns it in the list; the Entities screen renders it with the correct kind Pill
- **And** the creation is recorded in `audit_log_entries`; the entity's `owner_id` matches Toby's user ID.

**AC2 — Ownership graph: add edge and retrieve holding graph**  ‹maps: `OwnershipGraphIT`, web `entities.spec` ownership-tab›
- **Given** two active entities: "Toby (personal)" and "Wardian Holdings Ltd"
- **When** Toby adds an ownership edge (`parent=Toby personal`, `child=Wardian Holdings Ltd`, `pct=100`, `beneficial=true`)
- **Then** `GET /api/entities/:personal_id/holding-graph` returns a graph with the child node, annotated with `pct=100` and `beneficial=true`
- **And** the holding graph visualisation renders the edge; the `entity_ownership` row is audited.

**AC3 — Circular ownership rejected**  ‹maps: `CircularOwnershipFreeSpec`, `CircularOwnershipIT`›  *(invariant: circular ownership is rejected at write time)*
- **Given** a chain A → B → C exists in `entity_ownership`
- **When** Toby attempts to add an edge `C → A` (which would complete a cycle)
- **Then** the API returns **422** with error `CIRCULAR_OWNERSHIP`; no row is inserted into `entity_ownership`
- **And** the audit log records the failed attempt with the reason.

**AC4 — Accounting period open, close, and block on closed period**  ‹maps: `AccountingPeriodClosedIT`, web `entities.spec` periods-tab›  *(invariant: postings into a closed period are blocked)*
- **Given** an entity "Wardian Holdings Ltd" with a period "FY2025" (`starts_on=2025-01-01`, `ends_on=2025-12-31`, `status=open`)
- **When** Toby closes it via `POST /api/entities/:id/periods/:pid/close` with a note
- **Then** the period transitions to `closed`; `closed_at` and `closed_by` are set
- **And** a subsequent downstream write (e.g. a F39 account posting) dated within FY2025 returns **422 PERIOD_CLOSED** — no domain or TB write succeeds.

**AC5 — Consolidation: child rolled up with intercompany elimination**  ‹maps: `ConsolidationGroupIT`, `IntercompanyEliminationIT`›  *(invariant: consolidation is a computed view — never a ledger mutation)*
- **Given** a consolidation group "Toby Group" containing "Toby (personal)" and "Wardian Holdings Ltd", both with F39 balances; entity A has an intercompany receivable from entity B and B has a matching payable to A
- **When** Toby calls `GET /api/consolidation-groups/:id/net-worth`
- **Then** the consolidated net worth figure **eliminates** the offsetting intercompany receivable/payable; no new TigerBeetle postings are created by the consolidation query
- **And** a per-entity breakdown is included; the FX conversion to the group's base currency is labelled with the as-of rate (F37).

**AC6 — Per-entity base currency FX consolidation**  ‹maps: `ConsolidationFxIT`›  *(invariant: FX conversion uses stored transaction-date rates — F37)*
- **Given** a consolidation group with base_currency=`GBP`; one member entity has base_currency=`SGD` and a period-end balance of S$500,000
- **When** the consolidated net-worth is computed as of period-end date `2025-12-31`
- **Then** the SGD balance is converted to GBP using the F37 stored rate for `2025-12-31` (or nearest prior); the result is labelled "≈ £X at 31 Dec rate"
- **And** if the rate is missing, the fallback is the nearest-prior snapshot and the response flags the approximation.

**AC7 — Entities are Principal-private: Lorna and Marcia are denied (negative)**  ‹maps: `EntityAuthzIT`›  *(invariant: Principal-private; entity+permission scope-filtered server-side; no leak via consolidation/totals)*
- **Given** Lorna (Manager) and Marcia (Staff) are authenticated
- **When** either calls `GET /api/entities`, `GET /api/consolidation-groups/:id/net-worth`, or any entity-ownership or accounting-period endpoint
- **Then** both receive **403** with no entity data in the response body
- **And** `GET /api/me/permissions` for each returns an effective permission set with `entity: none`; the web app hides the Wealth nav section entirely for non-Principal users. No entity name, count, or consolidated figure is leaked via any other API response (Insights, search, totals).

**AC8 — Agent proposes entity creation; never auto-commits**  ‹maps: `AgentEntityProposeIT`›  *(invariant: financial and entity creation always proposed — F27)*
- **Given** the email agent (F25) parses a company incorporation document and identifies a new SPV
- **When** it processes the document
- **Then** a proposal appears in Triage (F26) with entity fields pre-filled (`kind=spv`, `jurisdiction`, `name` extracted); **no row is written** to `entities` at this point
- **And** only after Toby confirms in Triage does the entity row get created; the Agent's action is audited as a proposal, not a commit.

**AC9 — Two open periods for same entity rejected**  ‹maps: `DuplicateOpenPeriodIT`›
- **Given** entity "Wardian Holdings Ltd" already has an open period "FY2025"
- **When** Toby attempts to open a second period "FY2026" before closing "FY2025"
- **Then** the API returns **422** with error `PERIOD_ALREADY_OPEN`; no second period row is inserted
- **And** the existing open period remains unchanged.

## 10. Test plan

### Backend

- **FreeSpec (domain rules):**
  - `CircularOwnershipFreeSpec` — directed graph cycle detection with 3-node, 5-node, and disconnected cases; rejection invariant.
  - `OwnershipPctFreeSpec` — edge-level pct validation (0, >100, valid range).
  - `PeriodOverlapFreeSpec` — overlapping / contiguous / gapped period detection.
  - `ConsolidationEliminationFreeSpec` — intercompany elimination logic (matching types, partial match, no match).

- **weaver + Testcontainers (integration, PostgreSQL):**
  - `EntityCrudIT` — CRUD round-trip; soft-delete; owner_id enforcement.
  - `OwnershipGraphIT` — add edge, retrieve graph, depth-limited BFS.
  - `CircularOwnershipIT` — end-to-end rejection via the API.
  - `AccountingPeriodClosedIT` — open → close sequence; downstream write blocked after close; rollback `closing → open`.
  - `DuplicateOpenPeriodIT` — second open period rejected.
  - `ConsolidationGroupIT` — group CRUD; member add/remove; net-worth compute.
  - `IntercompanyEliminationIT` — elimination on consolidation; no TB mutation.
  - `ConsolidationFxIT` — per-entity base-currency FX normalization using stored rates; missing-rate fallback.
  - `EntityAuthzIT` — Principal-only enforcement; 403 for Manager / Staff on all entity endpoints; entity scope grant + revoke.
  - `AgentEntityProposeIT` — Agent proposal path through Triage; no direct entity write.
  - `EntityScopePropagationIT` — `entity_id` FK enforced on F39-stub account row; write without entity_id rejected.

### Web

- **Vitest:** entity service + Zod schema; ownership graph parser; period status state machine; consolidation group service.
- **Playwright (`entities.spec`):** full flow — create entity, add ownership edge, view holding graph, open/close period, view consolidated group; forbidden screen as Manager; agent proposal confirm flow.
- **axe** a11y on Entities list, Entity detail (all tabs), Consolidation group screen.
- **Visual diff** baselines: Entities list (light + dark); Entity detail tabs (Overview, Ownership, Periods); holding graph with 3-node tree.

### Mobile

Not a primary surface for entity/structure management in Wave G. Mobile shows entity name as a label on transaction/asset detail cards (read-only). Widget test: entity label renders correctly; no entity management actions on mobile.

## 11. Observability & audit

### Audit (F00 `audit_log_entries`)

Every write is audited:
- Entity create / update / soft-delete (before + after state).
- Ownership edge add / update / soft-delete.
- Accounting period open / `closing` / `closed` / rollback (actor + note).
- Consolidation group create / update / member add / remove.
- Entity scope grant / revoke.
- Failed ownership add due to `CIRCULAR_OWNERSHIP` (actor + attempted edge — important for compliance).
- Agent proposals (kind=`entity_create_proposal`, source=agent).

### Metrics (Prometheus / OpenTelemetry)

- `kanzen_entities_total{kind, status}` — gauge of active entities by kind.
- `kanzen_period_status_total{entity_id, status}` — periods by status.
- `kanzen_consolidation_compute_duration_ms` — consolidation query latency.
- `kanzen_circular_ownership_rejections_total` — guard-rail health.
- `kanzen_period_closed_write_blocks_total` — closed-period write blocks (indicates stale integrations).
- `kanzen_entity_authz_denials_total{actor_role}` — unauthorized access attempts.

### Alerts

- Consolidation compute exceeding 5s (structure complexity warning).
- Unresolved `period_closed_write_blocks` spike (integration out of sync with period status).

## 12. Open questions / decisions

1. **TigerBeetle per-entity account namespace strategy** — does each entity get a distinct TB account ID prefix / user-data partition, or do we use a shared cluster with entity-scoped account codes (F39 decision, but F42 must not foreclose it)? Lean: per-entity account code namespace in F39; F42 provides the entity ID, F39 maps it to TB account IDs.

2. **Entity scope grant granularity** — current design grants a non-Principal user access to a whole entity. Should it be per-resource within an entity (e.g. operational access to an entity's bills but not its balance sheet)? Lean: whole-entity scope for now; resource-level carve-out deferred to a later F02 extension if needed.

3. **Beneficial ownership reporting** — `beneficial` flag is recorded for the Principal's own records. Is there a requirement to export a beneficial ownership register (e.g. UK PSC register format)? Lean: out of scope for Wave G (Kanzen never files); deferred.

4. **Period granularity** — should periods be restricted to annual (fiscal year) or can they be quarterly / monthly? Current design allows free-form labels. Lean: free-form labels with `starts_on`/`ends_on`; the UI defaults to annual but imposes no constraint.

5. **Holding graph depth in the UI** — 5-level collapse is arbitrary. Real structures can be deeper. Lean: keep 5-level default; add a "show full graph" mode (paginated / zoom) as a follow-on.

6. **`parent_entity_id` column vs `entity_ownership` table** — the direct-parent convenience column on `entities` is redundant with the ownership table. Risk of divergence. Lean: keep the column for simple parent/child navigation (most entities are one level deep), but `entity_ownership` is authoritative for multi-parent and pct; a migration validates consistency.
