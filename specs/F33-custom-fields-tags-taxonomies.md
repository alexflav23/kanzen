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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — New taxonomy created and used with deep nesting, no schema migration**  ‹maps: `TaxonomyCreateIT`, web `settings.spec` taxonomies›
- **Given** no "Cleaning products" taxonomy exists
- **When** Toby creates the taxonomy with nodes: Cleaning products → Kitchen → Degreasers → Sprays (four levels deep) and categorises a list item under "Sprays"
- **Then** the list item shows the "Sprays" taxonomy chip on its detail, the taxonomy tree is navigable in Settings, and no database migration was required
- **And** the taxonomy creation and link are audited.

**AC2 — Custom field defined on vendors, set, and searchable**  ‹maps: `CustomFieldVendorIT`, web `settings.spec` custom-fields, `search.spec`›
- **Given** no "warranty portal URL" field exists on vendors
- **When** Toby defines a `url`-typed custom field "warranty portal URL" for entity_type `vendor`, and Lorna sets it on the Miele vendor record
- **Then** the field appears in the Miele vendor detail with the URL value
- **And** searching for the field value (F28) returns the Miele vendor in results.

**AC3 — Polymorphic tags applied to any entity and facetable in search**  ‹maps: `PolymorphicTagIT`, web `search.spec` tags›
- **Given** the tag "Priority" exists
- **When** Lorna applies "Priority" to a vendor, a list item, and a document
- **Then** all three entity types carry the tag and the `entity_tags` rows reflect the correct `entity_type`/`entity_id`
- **And** filtering by "Priority" in search (F28) returns all three entities.

**AC4 — Unknown key in attributes accepted and flagged for data-quality**  ‹maps: `UnknownKeyFlagIT`, web `asset-detail.spec` custom-fields›
- **Given** a watch asset with a typed template (F22)
- **When** Lorna PATCHes the asset with an `attributes` key "restoration_note" not present in the template
- **Then** the value is stored in `assets.attributes` and displayed on the asset detail
- **And** a data-quality flag (F23) is raised marking "restoration_note" as an unknown key (promotable to a template field), and the flag is visible in the Inbox.

**AC5 — Sensitive custom field on Principal-private asset hidden from Manager (negative)**  ‹maps: `SensitiveFieldAuthzIT`›  *(invariant: sensitive custom fields inherit host entity permission; no leak)*
- **Given** a custom field "insurance broker ref" marked `sensitive = true` defined on assets, and set on a watch
- **When** Lorna (Manager) requests the watch detail
- **Then** the "insurance broker ref" field is **absent / field-stripped** from the response — she sees other custom fields but not the sensitive one
- **And** Marcia (Staff) also receives a **403/empty** for that field, and the field value is never included in any aggregate or search result they can access.

**AC6 — Typed template (F22) and freehand field coexist on the same asset**  ‹maps: `TrunkPlusFreehandIT`›
- **Given** a porcelain asset using the Porcelain category template (typed trunk fields) and a freehand "storage_cabinet" attribute not in the template
- **When** the Specifications tab and the Custom fields section render
- **Then** the template-defined fields appear in the Specifications tab (typed, validated) and the freehand "storage_cabinet" appears in the Custom fields section
- **And** both are stored in `assets.attributes` and both are returned in the asset response.

**AC7 — Taxonomy node deletion guarded when entities are linked**  ‹maps: `TaxonomyNodeDeleteGuardIT`›
- **Given** the "Sprays" taxonomy node has 3 list items linked to it
- **When** Toby attempts to delete the "Sprays" node
- **Then** deletion is **blocked** with a message listing the linked entities
- **And** once all links are removed, the node can be soft-deleted and the taxonomy tree updates.

**AC8 — Only Principal can define taxonomies and custom-field definitions (negative)**  ‹maps: `ExtensibilityAuthzIT`›
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** Lorna attempts `POST /api/taxonomies` or `POST /api/custom-fields` and Marcia attempts the same
- **Then** both receive **403**
- **And** Lorna can still set custom-field values and apply tags to entities within her operational scope.

## 10. Test plan
Backend (weaver+PG): polymorphic tags + taxonomy links; infinite-tree CRUD + reparent/delete guards; template validation + unknown-key acceptance/flagging; custom-field sensitivity → RBAC; applies_to enforcement; GIN/trigram facet queries. Web: Vitest custom-fields/tag/taxonomy editors; Playwright add-taxonomy + custom-field-on-vendor + tag-anything.

## 11. Observability & audit
Audit: taxonomy/node, template, custom-field-definition CRUD; tag/link changes. Metrics: taxonomies/nodes count, custom fields per entity-type, unknown-key rate (promotion candidates), tag usage.

## 12. Open questions
1. Which entities get `attributes`/tags/taxonomies in v1 (assets ✅ + vendors + products/list-items confirmed; people/properties/documents — confirm). 2. How aggressively to nudge "promote freehand → template field" (F23). 3. Whether non-Principal roles may create taxonomies/tags or only use them.
