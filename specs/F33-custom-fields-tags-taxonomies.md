# Feature F33 — Custom fields, tags & user-defined taxonomies (extensibility)

| | |
|---|---|
| **Feature ID** | F33 |
| **Milestone** | M1.5 (cross-cutting; usable as entities land) |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | F02 (authz); generalises F04 (asset attributes/tags/categories) + F22 (templates) across all entities |
| **Spec references** | SPEC §8.3 (JSONB attributes), §8.1 (categories/tags), guiding principle "trunk + freehand"; user request (this turn) |

> **Decisions (revisitable):** every extensible object has a **mandatory typed "trunk"** (its core columns, defined in its feature spec) **plus freehand extensibility**: an **`attributes jsonb`** for ad-hoc/custom fields, **polymorphic tags**, and attachment to **user-definable taxonomies** (multiple infinite category trees, not just the asset one). Optional **templates** add typing/validation per entity-type or taxonomy node; unknown keys are always allowed (flagged for data-quality). **Mechanism = JSONB + Postgres trees** (not EAV, not Avro). Applies to **assets, vendors, list items/products, people, properties, documents**.

## 1. Purpose & user value
"If we didn't think of it, you can still add it." A consistent way to extend any object — define a custom field on a vendor, tag anything, spin up a new taxonomy ("Wine", "Art movements", "Cleaning products") and categorise infinitely — without a schema change or an engineer. The trunk keeps the system coherent; the freehand keeps it from ever boxing you in.

## 2. Roles & permissions
Resource `taxonomy`/`custom_field` — **Principal/admin** define taxonomies, templates and custom-field definitions; **Manager** uses them (set values, tag, categorise) operationally; **Staff** scoped. Custom values inherit the host entity's permissions/scope (a custom field on a Principal-private asset stays Principal-private).

## 3. Data model
`V__extensibility.sql` (cross-cutting; created after F02 — polymorphic links need no entity FKs):
- **Freehand fields**: each extensible entity carries **`attributes jsonb default '{}'`** (assets already have it as the vertical store; F08/F09/F10/F03/F05 add it for ad-hoc custom fields). Validated against a template where one exists; unknown keys allowed.
- **`custom_field_definitions`** — `id, owner_id, entity_type text, key text, label text, type ('text'|'number'|'money'|'date'|'bool'|'enum'|'url'), enum_values jsonb null, applies_to_taxonomy_node uuid null, sensitive bool, sort_order, created_at`. Drives the UI for "add a field"; values live in the host's `attributes`.
- **Tags (polymorphic)**: **`tags`** (`id, owner_id, name, slug, color`) + **`entity_tags`** (`tag_id, entity_type, entity_id`). Generalises asset tags to **any** entity.
- **User-defined taxonomies**: **`taxonomies`** (`id, owner_id, name, slug, applies_to text ('asset'|'vendor'|'product'|'any'|…), description, is_system bool`) + **`taxonomy_nodes`** (`id, taxonomy_id, parent_id uuid null, name, slug, sort_order` — **infinite tree**) + **`entity_taxonomy_links`** (`taxonomy_node_id, entity_type, entity_id`). The asset **`categories`** tree (F04) is the built-in `is_system` taxonomy `assets`; users add their own.
- **Templates (generalised)**: F22's `category_templates` become a specialisation of **`entity_templates`** (`id, entity_type|taxonomy_node_id, name, version, schema jsonb`) — typed field-sets for any entity-type or taxonomy node.

## 4. API
- **Custom fields**: `GET/POST/PATCH/DELETE /api/custom-fields?entity_type=` ; values set via the host entity's PATCH (`attributes`).
- **Tags**: `GET/POST /api/tags` · `POST/DELETE /api/{entity}/:id/tags` (polymorphic).
- **Taxonomies**: `GET/POST/PATCH /api/taxonomies` · `POST /api/taxonomies/:id/nodes` (add node, any depth) · `POST/DELETE /api/{entity}/:id/taxonomy-links`.
- **Templates**: `GET /api/entity-templates?entity_type=|node=` · CRUD (Principal); `POST /api/{entity}/validate-attributes`.

## 5. UI / screens & states
- **On any entity detail**: a **"Custom fields"** section (add/edit ad-hoc fields, typed) + a **tag editor** (`+ add` pill, as on assets) + **taxonomy chips** (attach to nodes from any applicable taxonomy).
- **Settings → Taxonomies & fields**: manage taxonomies (infinite tree editor — add category/sub-category at any depth), entity templates, and custom-field definitions. Mirrors the asset category/template editor (F22), generalised.
- **Search/filters** (F28): tags + taxonomy nodes + custom fields are facetable/searchable.
- States: typed validation, freehand (unknown key) accepted + flagged, empty.

## 6. Business rules & validation
- **Trunk is mandatory + typed** (per the entity's feature spec); **freehand is optional + flexible** (`attributes` JSONB).
- **Templates validate** the known subset of `attributes` (required/type/enum); **unknown keys are allowed** but surfaced in data-quality (F23) so the model can be "promoted" to a template field later.
- **Infinite taxonomies**: any number of taxonomies, each an unbounded tree; an entity may link to many nodes across taxonomies (vs the single primary asset `category_id` trunk field).
- **Permissions/scope inherit** from the host entity (a `sensitive` custom field follows field-level RBAC, F02).
- **GIN-indexed** `attributes`; trigram on tag/node names; all facetable in F28.
- **No EAV / no Avro**: JSONB for fields, Postgres trees for taxonomies — chosen for query power + flexibility.

## 7. Integrations
Generalises F04 (assets) + F22 (templates); used by F08 (products), F09 (vendors), F10 (people), F03 (properties), F05 (documents); facets feed F28 (search) + F29 (insights); unknown-key flags feed F23 (data quality).

## 8. Edge cases
Custom field later promoted to a template field (migrate values); taxonomy node deleted with linked entities (reparent/guard); same name across taxonomies; tag merge; very deep trees; a custom field marked sensitive (RBAC); freehand sprawl (data-quality nudges to consolidate); applies_to mismatch (a vendor-taxonomy node on an asset → blocked).

## 9. Acceptance criteria
- **AC1** A user adds a brand-new taxonomy "Cleaning products" and nests categories several levels deep, then categorises a list item under it — no schema change.
- **AC2** A custom field ("warranty portal URL") is defined on **vendors**, set on a vendor, and shows on its detail + is searchable.
- **AC3** Any entity (vendor, list item, person) can be tagged; tags are shared/polymorphic and facetable in search.
- **AC4** Adding an unknown key to an asset's `attributes` is accepted and flagged for data-quality (promotable to a template field).
- **AC5** A `sensitive` custom field on a Principal-private asset is hidden from the Manager (F02).
- **AC6** Porcelain (typed template, F22) and a freehand one-off both work through the same trunk+freehand model.

## 10. Test plan
Backend (weaver+PG): polymorphic tags + taxonomy links; infinite-tree CRUD + reparent/delete guards; template validation + unknown-key acceptance/flagging; custom-field sensitivity → RBAC; applies_to enforcement; GIN/trigram facet queries. Web: Vitest custom-fields/tag/taxonomy editors; Playwright add-taxonomy + custom-field-on-vendor + tag-anything.

## 11. Observability & audit
Audit: taxonomy/node, template, custom-field-definition CRUD; tag/link changes. Metrics: taxonomies/nodes count, custom fields per entity-type, unknown-key rate (promotion candidates), tag usage.

## 12. Open questions
1. Which entities get `attributes`/tags/taxonomies in v1 (assets ✅ + vendors + products/list-items confirmed; people/properties/documents — confirm). 2. How aggressively to nudge "promote freehand → template field" (F23). 3. Whether non-Principal roles may create taxonomies/tags or only use them.
