# Feature F03 — Properties, locations & defects

| | |
|---|---|
| **Feature ID** | F03 |
| **Milestone** | M1 |
| **Domain** | Properties |
| **Status** | ✅ spec complete |
| **Depends on** | F02 |
| **Spec references** | SPEC §3.1, §7.3, §6, §8.5; `input/views/properties.jsx`, App. E.4 |

> **Decisions (this feature):** location hierarchy is a **typed nested tree** (arbitrary depth); linked external systems are **reference-only** in F03 (the property's **task project is native**, created in F06; Calendar in F07; Drive/1Password are stored references); **defects are a first-class entity**.

---

## 1. Purpose & user value
The digital **Property Bible** — one rich record per property (Wardian, Singapore, and future). It is the spatial backbone of the whole system: assets live in **locations** within properties, bills/vendors/maintenance/defects are scoped to a property, and property scope drives authorization (F02). Staff see only their property; the Principal sees all.

## 2. Roles & permissions
Resource `property` (+ child resources `room`/`location`, `defect`), property-scoped (F02):
- **Principal** — `admin` on all properties.
- **Manager** — `write` on all properties (create/edit, manage locations, defects).
- **Staff** — `read` on their assigned property's Bible basics; `write` to **raise a defect**; no access to other properties.
- All access filtered by `property_scopes` (F02): a Singapore-scoped user never sees Wardian.

## 3. Data model
`V1_3_0__properties.sql`:

- **`properties`** — `id uuid pk`, `owner_id uuid`, `name text`, `address text`, `jurisdiction text` (`uk`/`sg`/…), `country text`, `type text` (`apartment`/`house`/`other`), `ownership text` (`owned`/`leased`/`managed`), `building_mgmt text null`, `cover_key text` (visual key / gradient; optional uploaded cover in S3 later), `default_currency text` (`GBP`/`SGD`), `calendar_id text null`, `drive_folder_id text null`, `vault_name text null`, `task_project_id uuid null` (set by F06), `status text` (`active`/`archived`/`sold`), `created_at`, `updated_at`, `deleted_at null`.
- **`locations`** — the **typed nested tree**: `id uuid pk`, `owner_id`, `property_id → properties`, `parent_id uuid null → locations` (null = top level under the property), `kind text` (`room`/`area`/`cabinet`/`shelf`/`case`/`garage`/`storage`/`other`), `name text`, `floor text null`, `area text null` (e.g. m²), `notes text null`, `sort_order int`, `created_at`, `updated_at`, `deleted_at null`. Index on `(property_id, parent_id)`. Assets (F04) reference `location_id`.
- **`asset_location_history`** — `id`, `asset_id uuid` (FK added in F04), `location_id → locations`, `moved_at timestamptz`, `moved_by uuid`, `note text null`. (Defined here as the locations-domain table; populated by F04/F19.)
- **`asset_custody_history`** — `id`, `asset_id uuid` (FK added in F04), `custody_state text` (`with_owner`/`with_family`/`with_repair_shop`/`with_appraiser`/`lent_out`/`sold_pending_collection`/`in_transit`), `party_id uuid null` (F09 vendor/contact), `changed_at`, `changed_by`, `note`. Custody-state enum defined here.
- **`defects`** — `id uuid pk`, `owner_id`, `property_id → properties`, `location_id uuid null → locations`, `title text`, `description text`, `severity text` (`low`/`medium`/`high`), `status text` (`open`/`in_progress`/`resolved`/`wont_fix`), `reported_by uuid`, `assigned_vendor_id uuid null` (F09), `linked_task_id uuid null` (F06), `reported_at`, `resolved_at null`, `created_at`, `updated_at`, `deleted_at null`.

All writes audited (F00). Property-scoped queries always filter by `property_id ∈ scope`.

## 4. API (Tapir endpoints)
- **Properties**: `GET /api/properties` (scoped) · `GET /api/properties/:id` (Bible aggregate: counts, linked systems) · `POST` · `PATCH` · `POST /api/properties/:id/archive`.
- **Locations**: `GET /api/properties/:id/locations` (tree) · `POST /api/locations` (with `parent_id`) · `PATCH /api/locations/:id` (rename/notes) · `POST /api/locations/:id/move` (reparent subtree) · `DELETE /api/locations/:id` (guarded — see edge cases).
- **Defects**: `GET /api/properties/:id/defects?status=` · `POST /api/defects` (raise) · `PATCH /api/defects/:id` (edit, assign vendor) · `POST /api/defects/:id/status` (transition) · optional `POST /api/defects/:id/task` (spawn a native task, F06).
- **Bible read aggregates**: rooms/assets/bills/vendors/open-defects/maintenance-plan counts for the overview cards.

## 5. UI / screens & states
Per `properties.jsx` + App. E.4:
- **Properties list**: cards (cover, jurisdiction/ownership/type pills, 4-stat footer: rooms/assets/bills/vendors). "Add property".
- **Bible**: cover header + tabs **Overview** · **Rooms** (→ the location tree) · **Assets** (F04 table) · **Utilities** (bills, F15) · **Maintenance** (plans, F11) · **Defects** · **Documents** (F05).
  - **Overview**: Particulars (`meta-grid`); **Linked systems** card (native task project link, Google Calendar, optional Drive folder, **1Password vault — reference only, never a secret**); At-a-glance stat grid.
  - **Rooms / locations**: the nested tree, expandable; add room → add nested sub-location; per-node asset list (F04). Node kinds typed.
  - **Defects**: list (severity bar, status pill, vendor, reported-by); raise-defect form; status transitions; "create task" action (F06).
- **States**: empty (no rooms/defects), loading, error; scoped-empty (a Singapore-scoped user opening Wardian → not found/forbidden).

> **Status (2026-05-28):** Overview · Rooms · Defects live (incl. Report-defect lifecycle + Add-room). **W4 added Assets · Maintenance · Documents** tabs — all property-scoped: Assets via `GET /api/assets?property=` (resolves location → property; rows deep-link to the registry detail + "Open in registry →"), Maintenance via the plans list filtered on `PlanView.propertyId`, Documents via the docs list filtered on `propertyId` (immutable originals badged; `principal_private` papers stripped server-side — verified a Manager cannot see the Title Register). Seed body in **V2_76** (5 items placed in Wardian rooms + EPC/Insurance/Title/Singapore-tenancy docs). **Utilities (bills)** deferred to W5/Finance (needs `Bill.propertyId`). **Overview depth** (full Particulars + Linked-systems card), **location-tree depth** (richer kinds, per-node assets, move/reparent, delete-guard) and **property admin** (assign-vendor/spawn-task/edit/archive) are the remaining W4 slices.

## 6. Business rules & validation
- **Location tree integrity**: a node's `parent_id` must belong to the same `property_id`; no cycles (reparent validates); depth unbounded but typed.
- **Delete guards**: deleting a location with child locations or attached assets is blocked (must move/empty first) — soft-delete only when empty.
- **Defect lifecycle**: `open → in_progress → resolved|wont_fix`; `resolved_at` set on resolve; reopening allowed (audited).
- **Property scope** enforced on every read/write (F02); Staff `write` limited to raising defects on their property.
- **Archive/sell**: archived properties are read-only and hidden from default lists; their assets/history are preserved.
- **Vehicles**: a vehicle asset (F22 vertical) is *located* at a property's `garage` location — no separate place model.

## 7. Integrations / external systems
- **None live in F03.** Linked-system fields are stored references only. The native **task project** (`task_project_id`) is created/linked in **F06**; **Google Calendar** id in **F07**; **Drive folder** + **1Password vault** are reference strings (1Password never holds a secret in Kanzen — display/name only).

## 8. Edge cases
- Reparenting a subtree across properties → rejected (locations are property-bound).
- Deleting a room containing assets → blocked with a clear "move N assets first".
- Defect raised by Staff on a location they can see but assigned to a vendor not approved for that property → vendor pick is property-scoped (F09).
- Property archived while it has open defects/active bills → warn; keep records, stop new activity.
- Concurrent location edits → optimistic concurrency (updated_at check).
- Scoped user requests another property's Bible → 403/404 (don't leak existence).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Seed & view the two Bibles**  ‹maps: `PropertyIT.seed`, web `properties.spec`›
- **Given** a freshly seeded system
- **When** Toby opens **Properties**
- **Then** he sees two cards — *Wardian, Apt 5206* (UK) and *Singapore* (SG) — each with cover, jurisdiction/ownership/type pills and live counts (rooms/assets/bills/vendors)
- **And** opening either Bible shows Particulars, linked-system **references** (native task project, Calendar, Drive/1Password names — never a secret), and at-a-glance counts.

**AC2 — Build a nested location tree**  ‹maps: `LocationTreeIT`, web rooms-tree Vitest›
- **Given** Wardian has no rooms
- **When** Lorna adds *Living room → Cabinet → Shelf → Case*
- **Then** the tree renders nested and expandable
- **And** an F04 asset can attach to any node and appears under it.

**AC3 — Delete guards**  ‹maps: `LocationDeleteIT`›
- **Given** a location *Study* containing 3 assets
- **When** Lorna tries to delete *Study*
- **Then** it is blocked with "move 3 assets first" (no delete)
- **And** an empty location soft-deletes (`deleted_at` set), history preserved.

**AC4 — Property scope (negative)**  ‹maps: `PropertyScopeIT`, web `properties.spec` scope›
- **Given** Marcia is Wardian-Staff
- **When** she requests the Singapore Bible (`GET /api/properties/:sg`)
- **Then** she gets **403/404** — existence not leaked
- **And** her Properties list shows **only Wardian**.

**AC5 — Staff may raise a defect, nothing more**  ‹maps: `DefectAuthzIT`›
- **Given** Marcia on Wardian
- **When** she raises a defect (title/severity/location)
- **Then** it is created with `reported_by = Marcia` and audited
- **And** her attempt to edit property particulars or a location is **denied (403, default-deny)**.

**AC6 — Defect lifecycle + audit**  ‹maps: `DefectLifecycleIT`›
- **Given** an open defect
- **When** Lorna moves it `open → in_progress → resolved`
- **Then** `resolved_at` is set and **each transition is audited**
- **And** once F06 lands, a high-severity defect optionally spawns a native task.

**AC7 — Manager sees all; scoped Staff sees one**  ‹maps: `PropertyScopeIT`›
- **Given** Lorna (Manager, all) and Siti (Singapore-Staff)
- **When** each lists properties
- **Then** Lorna sees **both**; Siti sees **only Singapore**.

**AC8 — Archived property is read-only**  ‹maps: `PropertyArchiveIT`›
- **Given** a property with open defects/active bills
- **When** Toby archives it
- **Then** it is hidden from default lists and **new activity is blocked**, while assets/history are preserved (warned first).

## 10. Test plan
- **Backend** (weaver + testcontainers-PG): location-tree invariants (same-property parent, no cycles, reparent), delete guards, defect lifecycle transitions, property-scope filtering (F02 integration), archive read-only.
- **Web**: Vitest for the location-tree component (expand/add/move) and the defect form; Playwright e2e of the Bible tabs + scope (Manager vs Staff vs scoped user).
- **Seed test**: the two real properties load with correct counts.

## 11. Observability & audit
- Audit: property create/edit/archive, location add/move/delete, defect raise/edit/status-change/assign.
- Metrics: open-defect count by property/severity, locations per property, scope-denied requests.

## 12. Open questions / decisions
1. **Property cover** — generated gradient keyed by name (prototype) vs an uploaded cover image (S3). *(Lean: gradient now, optional upload later.)*
2. **Defect → task automation** — raising a defect auto-creates a native task (F06) vs manual "create task". *(Lean: optional toggle, default on for high severity.)*
3. **Custody history home** — confirm `asset_location_history`/`asset_custody_history` live in the locations domain (defined here, FK'd in F04) vs created entirely in F19. *(Lean: define here, FK in F04.)*
4. **Per-property currency** — `default_currency` on the property drives money display defaults; confirm vs a global per-jurisdiction map.
