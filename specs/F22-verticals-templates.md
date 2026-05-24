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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Canonical tree + 8 templates seed and render**  ‹maps: `TemplateSeedIT`, web `specs-tab.spec`›
- **Given** a freshly migrated system
- **When** Toby opens **Settings → Categories & templates**
- **Then** the canonical top-level categories are present (Watches & Jewellery, Art, Instruments, Furniture, Clothing & Shoes, Porcelain, Glassware, Vehicles, …) with all 8 vertical templates seeded
- **And** each template's fields, types, and required flags match the Appendix C definitions.

**AC2 — Guitar vertical renders the correct typed fields**  ‹maps: `GuitarTemplateIT`, web `specs-tab.spec` guitar›
- **Given** Toby creates a new asset under the Guitar category
- **When** the create-asset form loads the category template
- **Then** fields for maker, model, year, serial, pickups (enum), and other App. C guitar fields appear with correct input types and required markers
- **And** submitting without a required field is blocked with an inline validation error.

**AC3 — Watch vertical shows movement/serial/box-and-papers**  ‹maps: `WatchTemplateIT`, web `specs-tab.spec` watch›
- **Given** an existing watch asset
- **When** the Specifications tab renders
- **Then** movement type (enum), serial, box-&-papers (bool), and other watch fields are shown with their stored values
- **And** editing and saving an enum field validates against the allowed values.

**AC4 — Attribute validation: wrong type and invalid enum blocked**  ‹maps: `AttributeValidationIT`›
- **Given** a porcelain asset with a template that has a `year` (number) and a `condition` (enum: mint/good/fair/poor)
- **When** Lorna submits `year = "abc"` or `condition = "excellent"` (not in enum)
- **Then** both submissions are rejected (422) with per-field error details
- **And** a valid submission persists and appears correctly on the Specifications tab.

**AC5 — Vehicle saved view with MOT/tax/insurance and date reminders**  ‹maps: `VehicleViewIT`, `VehicleReminderIT`, web `inventory.spec` vehicles›
- **Given** a vehicle asset with registration, MOT expiry, road-tax expiry, and insurance renewal dates
- **When** the Vehicles saved Inventory view loads
- **Then** the view shows the vehicle-specific columns (reg/VIN/MOT/tax/insurance) for all vehicle-category assets
- **And** dates within the reminder window raise F11 reminders in the Inbox.

**AC6 — New vertical created by adding a template, no schema migration**  ‹maps: `NewVerticalNoMigrationIT`›
- **Given** no existing "Wine" category template
- **When** Toby creates a Wine category node and a corresponding template (fields: vintage year, region, varietal, bottle count)
- **Then** a new Wine asset can be created with those typed fields immediately
- **And** the database schema has not changed — values are stored in `assets.attributes` JSONB.

**AC7 — Template versioning: existing assets preserve values after schema change**  ‹maps: `TemplateVersioningIT`›
- **Given** 10 guitar assets with a populated `serial` field, and template version 1
- **When** Toby adds a new optional field `finish` to the guitar template (bumping to version 2)
- **Then** all 10 existing assets retain their `serial` values and the Specifications tab renders correctly
- **And** the template record shows `version = 2`; existing assets show `finish` as blank/unset.

**AC8 — Wear/use counts in clothing template**  ‹maps: `WearCountIT`›
- **Given** a clothing asset using the Clothing & Shoes template
- **When** the `wear_count` field is incremented and saved
- **Then** the updated count is stored in `assets.attributes` and displayed on the Specifications tab
- **And** `dry_cleaning_history` entries are accepted as the template defines.

**AC9 — Principal edits templates; Manager/Staff cannot (negative)**  ‹maps: `TemplateAuthzIT`›
- **Given** Lorna (Manager) and Marcia (Staff)
- **When** either attempts to create or edit a category template via `POST /api/category-templates`
- **Then** both receive **403**
- **And** Lorna can still use templates when creating/editing assets.

## 10. Test plan
Backend (weaver+PG): tree seed, template validation (required/type/enum), versioning, vehicle reminders, GIN attribute filtering. Web: Vitest SpecsTab template render + create-asset form; Playwright add-guitar/watch.

## 11. Observability & audit
Audit: template/tree CRUD. Metrics: assets per vertical, attribute completeness per template, validation failures.

## 12. Open questions
1. **Canonical tree** final shape (seed proposal in this feature). 2. Template versioning/migration UX. 3. Per-vertical event templates (ties F19).
