# Feature F04 — Asset registry core

| | |
|---|---|
| **Feature ID** | F04 |
| **Milestone** | M1 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (locations), F02 (authz); soft-couples F05 (media) |
| **Spec references** | SPEC §8.1–8.3; `input/views/assets.jsx`, `asset-detail.jsx`, `collections.jsx`, App. E.5–E.7 |

> **Decisions (this feature):** vertical attributes stored as a **JSONB column** on the asset (validated against typed templates from F22), **not** EAV — spec §8.3/Appendix A patched to match. Asset **photos route through the Documents store** (F05): hero photo + gallery are document links. This feature delivers the **model + Inventory list/grid + asset-detail shell + collections/tags/groups**; lifecycle/valuation/provenance/completeness/restructure arrive in F19–F24.

---

## 1. Purpose & user value
The unified registry of everything the household owns — one model spanning the boiler, the dining chairs, the watch collection and the cars. Create, categorise, locate, group and browse assets, with the **Inventory** grid/list and the timeline-centric **asset detail** shell. It is the spine the whole registry (valuation, provenance, costs, insights) hangs off.

## 2. Roles & permissions
Resource `asset` (+ `collection`, `category`, `tag`, `asset_group`), Principal-private with the Manager carve-out (F02):
- **Principal** — `admin` (incl. the sensitive valuation/insurance fields added in F20/F21).
- **Manager** — `write` on assets (create/edit core, categorise, locate, group, collections), but field-denied on `market_value`/`insured_value`/`valuation_snapshots` (F02/F20).
- **Staff** — `none` on Inventory.
- Property scope applies to assets via their `location → property`.

## 3. Data model
`V1_4_0__assets.sql`:

- **`categories`** — parent/child tree: `id uuid pk`, `owner_id`, `parent_id uuid null → categories`, `name text`, `slug text`, `sort_order int`, `created_at`, `deleted_at`. Seed minimal top level (Watches, Art, Guitars, Furniture, Clothing, Porcelain, Glassware, Vehicles); the full canonical tree is finalised in F22 (SPEC §19 #4).
- **`assets`** — `id uuid pk`, `owner_id`, `title text`, `maker text null` (denormalised brand/maker/artist for search & cards), `description text null`, `category_id → categories`, `vertical text null` (template key: `guitar`/`watch`/`art`/…), `tracking_mode text` (`unique`/`grouped_quantity`/`structured_set`), `quantity int default 1`, `original_quantity int null` (preserved across restructure), `parent_asset_id uuid null → assets` (structured-set children), `acquisition_date date null`, `acquisition_cost_minor bigint null`, `acquisition_currency text null`, `merchant_id uuid null` (F13), `ownership_status text` (`owned`/`sold`/`gifted`/`lost`/`stolen`/`archived`), `condition_status text null`, `location_id uuid null → locations` (F03), `custody_status text default 'with_owner'`, `hero_document_id uuid null` (F05), **`attributes jsonb default '{}'`** (vertical attrs), `notes text null`, `created_at`, `updated_at`, `deleted_at null`. Adds the FKs to `asset_location_history`/`asset_custody_history` (defined in F03).
- **`tags`** — `id, owner_id, name, slug`; **`asset_tags`** — `(asset_id, tag_id)`.
- **`collections`** — `id, owner_id, name, description, visibility ('principal'|'shared'), currency, created_at, deleted_at`; **`collection_members`** — `(collection_id, asset_id)`. (Logical groupings — many-to-many.)
- **`asset_groups`** — `id, owner_id, name, kind ('order'|'set'|'rig'|'other'), notes`; **`asset_group_members`** — `(group_id, asset_id)`. (Structural peer groupings — e.g. four chairs from one order — distinct from `parent_asset_id` structured sets and from logical collections.)
- **Indexes**: `assets(category_id)`, `assets(location_id)`, `assets(ownership_status)`, GIN on `assets.attributes`, trigram on `title`/`maker` for search.

### Spec patch
SPEC §8.3 + Appendix A updated: vertical attributes are a **JSONB column validated against typed category templates** (F22), replacing the `asset_attribute_values` table; `category_templates`/`asset_attribute_definitions` remain as the **template catalog** (typing, validation, per-vertical UI).

## 4. API (Tapir endpoints)
- **Assets**: `GET /api/assets` (faceted: `category` incl. descendants, `property`, `status`, `collection`, `tag`, `q` over title/maker; sort; pagination) · `GET /api/assets/:id` (field-filtered by F02) · `POST` · `PATCH` · `POST /api/assets/:id/location` · `POST /api/assets/:id/custody` · `POST /api/assets/:id/hero-photo` (set from a document) · soft `DELETE`.
- **Grouped/structured**: `POST /api/assets` with `tracking_mode`; `POST /api/assets/:id/children` (structured-set); quantity edits on grouped.
- **Categories**: tree CRUD. **Tags**: CRUD + `POST/DELETE /api/assets/:id/tags`. **Collections**: CRUD + `POST/DELETE /api/collections/:id/members`. **Asset groups**: CRUD + members.
- *(Merge/split/regroup = F24; valuation/events = F19/F20 — endpoints stubbed.)*

## 5. UI / screens & states
Per `assets.jsx` / `asset-detail.jsx` / `collections.jsx` + App. E.5–E.7:
- **Inventory**: summary strip (assets shown / estimated value* / insured value* / completeness* — *value & completeness show acquisition-cost sums / placeholders until F20/F23); sticky **filter rail** (Category tree, Property, Status, Collection, Tag chips); toolbar (search, **Grid / List / Timeline†** toggle, sort); active-filter chips; results. **Asset card** (hero photo, maker, title, value, tag, location, mode badge ×N/set/At-service). †Timeline view is a placeholder until F19.
- **Asset detail (shell)**: hero (photo, category/status/condition pills, maker, title, key facts, completeness bar†); tabs **Timeline†** · **Specifications** (renders `attributes` JSONB; typed per-vertical UI in F22) · **Valuation†** · **Provenance & insurance†** · **Documents** (F05) · **Comments**; sidekick (lifetime cost†, in-collections, tags, quick actions: log event†/move/upload photo/restructure†). († = placeholder/disabled until the owning feature lands.)
- **Collections**: card grid (4-up collage, member count, total value*, lock if Principal-private) → detail (asset card grid).
- **Create/edit asset**: title, maker, category (→ vertical template, generic field set in F04, typed in F22), tracking mode + quantity, location (F03 tree picker), acquisition date/cost/currency, tags, collections, photo upload (F05). States: validation, save, error.

## 6. Business rules & validation
- **Tracking modes**: `unique` (qty 1); `grouped_quantity` (qty ≥1, `original_quantity` set on restructure); `structured_set` (parent + `parent_asset_id` children). A child cannot be its own ancestor.
- **Category** required; must exist in the tree; filtering by a parent category includes descendants.
- **Attributes JSONB** validated against the category's template when a template exists (F22); unknown keys allowed but flagged.
- **Location** must belong to a property in the user's scope; setting location writes `asset_location_history`; custody change writes `asset_custody_history` (F03 tables).
- **Money** as minor units + currency (no float).
- **Soft delete**; assets are never hard-deleted (provenance). Status `sold`/`gifted`/etc. are lifecycle outcomes (full events in F19).
- **Field-level read** enforced (Manager can't see valuation fields, F02).

## 7. Integrations / external systems
- **F05 Documents/S3** for photos (hero + gallery) — asset references documents; until F05 lands, photo upload is stubbed/feature-flagged.
- No external systems.

## 8. Edge cases
- Convert `grouped_quantity` ↔ `structured_set` (full restructure in F24; F04 forbids destructive change, defers to F24).
- Move an asset whose location is later deleted → blocked by F03 delete guard.
- Asset with no location/category (legacy) → allowed as a draft but flagged for F23 data-quality.
- Collection spanning currencies → totals shown per-currency (no silent FX).
- Scoped user (Manager on Singapore) listing Inventory → only Singapore-located assets; unplaced assets visible per rule.
- Large attribute blobs / deeply nested structured sets → bounded.

## 9. Acceptance criteria
- **AC1** Create a unique asset (a watch), a grouped asset (set of 6 tumblers, ×6), and a structured set (tea set with children); cards badge each correctly.
- **AC2** Faceted filtering by category (incl. children), property, status, collection and tag returns correct results; search matches title/maker.
- **AC3** An asset's vertical attributes save to `attributes` JSONB and render in the Specifications tab.
- **AC4** Setting location/custody writes history rows; moving respects property scope.
- **AC5** A Manager's `GET /api/assets/:id` omits valuation/insured fields; a Principal's includes them.
- **AC6** An asset belongs to multiple collections; a collection shows members + per-currency totals.
- **AC7** Photos attach via the Documents store and a hero photo renders on the card/detail.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG): tracking-mode invariants (cycle prevention, quantity rules), category-descendant filtering, JSONB attribute round-trip + GIN-indexed filter, location/custody history writes, field-level filtering (Manager vs Principal), scope filtering, collection/group membership.
- **Web**: Vitest for the filter rail + asset card + JSONB Specifications render; Playwright e2e of Inventory grid/list, filtering, asset create, and a collection.
- **Seed**: realistic assets across the eight verticals (watch, art, guitar, …) for demo + tests.

## 11. Observability & audit
- Audit: asset create/edit/delete, category/tag/collection/group changes, location/custody moves.
- Metrics: asset count by category/property/status, filter usage, search latency.

## 12. Open questions / decisions
1. **Canonical category tree** (SPEC §19 #4) — finalised in F22; F04 seeds the eight top-level verticals. Confirm tree shape now or defer.
2. **`maker` denormalisation** — keep a top-level `maker` for search/cards (recommended) vs derive from JSONB per vertical.
3. **Comments tab** — build asset comments in F04 (simple) vs defer with lifecycle. *(Lean: simple comments in F04; they're part of the audit trail.)*
4. **Estimated-value summary before F20** — show acquisition-cost sums as a placeholder vs hide the value tiles until valuation exists. *(Lean: show acquisition sums, label clearly.)*
