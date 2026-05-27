# Kanzen — Brand catalogue (design note)

Maker/brand reference data for the registry (and beyond) is a **global, server-side catalogue** — a
shared master library that everyone contributes to and benefits from, with per-account **hot caches**
for speed and personalised ranking. The model is MyFitnessPal's food database: a curated seed, plus
crowd enrichment (anyone can add a brand the moment they need one), with popularity surfacing the good
entries over time. It is explicitly **not** a hardcoded frontend list.

## Why
Watches, jewellery, vehicles, furniture, porcelain, glassware, fashion, instruments — each has a
finite, well-known brand set. Curated autocomplete makes asset capture fast and consistent (clean
`maker` values → better search, grouping, valuation comps later). But the set is never *complete*, and
hardcoding it in the web bundle means it can't grow, can't be shared with the agent (F27 proposals) or
mobile, and can't be enriched by use. A catalogue solves all of that.

## Multi-tenancy direction (eventual)
Kanzen will become multi-tenant — different family offices with **fully isolated** accounts. The brand
catalogue is the deliberate exception: it stays **global**. Every account's contributions enrich the
one shared library; each account gets a **hot cache** of the brands it actually uses for fast,
personalised suggestions. So: *global reference data + per-account usage*, never per-tenant copies.
Today `owner_id` stands in for the future `account_id`/`tenant_id`.

## Data model
- **`brands`** (global; not `owner_id`-scoped):
  `id`, `name`, `normalized` (lower/trimmed, for dedup + prefix search), `category` (the asset
  category/vertical key — `watches`/`jewellery`/`vehicles`/…), `status` (`verified` | `community`),
  `usage_count bigint` (global popularity), `created_by uuid null` (the account that contributed it;
  null = seeded), `created_at`, `deleted_at`. `unique(category, normalized)`.
- **`brand_usage`** (per-account hot cache): `(brand_id, owner_id, count, last_used_at)`,
  PK `(brand_id, owner_id)`. Indexed `(owner_id, count desc)`.

## Behaviour
- **`GET /api/brands?category=&q=&limit=`** — ranked suggestions: *this account's hot cache (usage
  desc) → global `usage_count` desc → `verified` before `community` → alphabetical*. `q` is a
  case-insensitive prefix/contains over `normalized`. Returns `{id, name, category, status}`.
- **`POST /api/brands {name, category}`** — **find-or-create + use** in one call: normalise the name;
  upsert into `brands` (`on conflict (category, normalized)` → reuse), inserting as `community`
  (`created_by = me`) if new; bump global `usage_count`; upsert `brand_usage` for this account
  (`count += 1`, `last_used_at = now()`). Returns the brand. Called when an asset is created with a
  maker, so the catalogue **and** the hot cache self-populate from real usage.
- **AuthZ**: brands are shared reference data, not Principal-private — **any authenticated principal**
  may read + add (crowd enrichment; even Staff proposing an asset benefits). Bearer required.

## Scope (this slice) / deferred
- **In:** the two tables + seed (the curated research, as `verified`), `BrandRepo`, the two endpoints,
  and the asset-create **Maker autocomplete** (keyed to the selected category) + record-on-create.
- **Deferred:** moderation/merge of `community` → `verified` (admin); aliases/synonyms + fuzzy match;
  the agent + mobile consuming the catalogue; per-vertical *typed* create fields (reg/VIN/mileage —
  F22/W3). Verification of community entries is manual/admin for now.
- **Richer brand records (future):** the table is lean today (name/category/status/usage). Operator
  source lists carry more — e.g. the furniture list (`V2_70`) had **country · tier · price ranges ·
  website · design notes**. Worth growing `brands` with `country`, `website`, and optional `tier`/notes
  so the catalogue becomes a proper brand reference (used on cards/detail + valuation comps later).

## Seed coverage
`V2_69` seeds ~273 brands across watches · jewellery · vehicles · furniture · clothing · guitars ·
porcelain · glassware. `V2_70` expands **furniture** to ~160 (operator's curated list + a broad
worldwide expansion). The seed grows by migration; users grow it at runtime via `POST /api/brands`.
