# Feature F22 — Verticals & category templates

| | |
|---|---|
| **Feature ID** | F22 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets/categories/JSONB attrs) |
| **Spec references** | SPEC §8.3, Appendix C, §19 #4/#11; `input/views/asset-detail.jsx → SpecsTab` |

> **Decisions (revisitable):** typed **category templates** define the JSONB-attribute schema per vertical (validation + per-vertical UI) — values live in `assets.attributes` (F04, not EAV); ships the **8 first-build verticals** (guitar, glassware, porcelain, clothing/shoes, furniture, watch/jewellery, **art**, vehicle, App. C) and the **canonical category tree** (resolves §19 #4); **vehicles** are a vertical surfaced as a saved Inventory view. Resolves wear/use counts (§19 #11) for clothing in-template.

## 1. Purpose & user value
Each kind of thing shows the right fields — a guitar asks for pickups and serial, a watch for movement and box-&-papers, art for edition and signature — without schema changes when a new vertical appears. The taxonomy + templates that make the registry feel bespoke per category.

## 2. Roles & permissions
Resource `category`/`category_template` — Principal/admin edits templates + tree; Manager uses them. Staff none.

## 3. Data model
`V__templates.sql` (+ seed):
- **`category_templates`** — `id, owner_id, category_id → categories, vertical_key text, name, version int, schema jsonb (ordered field defs), created_at`. `schema` field def: `{key, label, type ('text'|'number'|'enum'|'date'|'bool'|'money'), required, enum_values?, unit?, group?, sensitive?}`.
- **`asset_attribute_definitions`** — flattened catalog (derived from templates) for validation + faceted UI.
- Seeds the **canonical category tree** (top level: Watches & Jewellery, Art, Instruments, Furniture, Clothing & Shoes, Porcelain, Glassware, Vehicles, Home Systems, Electronics, …; with children) and the **8 templates** (App. C fields).

## 4. API
`GET /api/categories` (tree) · `GET /api/category-templates/:categoryId` · `POST /api/assets/validate-attributes` (against template) · template CRUD (Principal). Vehicles saved view = a stored faceted filter (F04) on the vehicle vertical.

## 5. UI / screens & states
- Fills the F04 **Specifications tab**: renders typed fields per the category's template (grouped, units, enums) instead of a generic dump.
- **Create/edit asset**: category pick → template-driven form (required fields, enums, units).
- **Settings → Categories & templates**: tree + template editor (Principal).
- **Vehicles**: a saved Inventory view (garage/reg/MOT/tax/insurance columns) — App. E.13.

## 6. Business rules & validation
- `assets.attributes` JSONB **validated against the category template** (required/type/enum); unknown keys allowed but flagged (F23).
- **Template versioning**: schema changes bump `version`; existing assets keep their values, re-validated lazily.
- **Vehicle vertical**: registration/VIN/MOT/road-tax/insurance/service-interval drive expiry reminders (F11) and the saved view (no separate domain).
- **Wear/use counts** (clothing/shoes) included as template fields (`wear_count`, `dry_cleaning_history`) — resolves §19 #11.

## 7. Integrations
F04 (attributes/categories), F11 (vehicle date reminders), F23 (template-completeness), F28 (faceted filtering uses attribute definitions).

## 8. Edge cases
Adding a brand-new vertical = add a template (no migration); template field removed (keep historical values); enum value retired; vehicle MOT/tax reminders; multi-vertical asset (rare → primary category).

## 9. Acceptance criteria
- **AC1** The canonical category tree + 8 templates seed; an asset's Specifications tab renders typed per-vertical fields.
- **AC2** Creating a guitar shows maker/model/year/serial/pickups…; a watch shows movement/serial/box-&-papers.
- **AC3** Attribute values validate against the template (required/type/enum).
- **AC4** Vehicles appear as a saved Inventory view with MOT/tax/insurance, and their dates raise reminders.
- **AC5** A new vertical is added by creating a template, with no schema migration.

## 10. Test plan
Backend (weaver+PG): tree seed, template validation (required/type/enum), versioning, vehicle reminders, GIN attribute filtering. Web: Vitest SpecsTab template render + create-asset form; Playwright add-guitar/watch.

## 11. Observability & audit
Audit: template/tree CRUD. Metrics: assets per vertical, attribute completeness per template, validation failures.

## 12. Open questions
1. **Canonical tree** final shape (seed proposal in this feature). 2. Template versioning/migration UX. 3. Per-vertical event templates (ties F19).
