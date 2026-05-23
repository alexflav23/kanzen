# Feature F35 — Products & stock (consumables / supplies)

| | |
|---|---|
| **Feature ID** | F35 |
| **Milestone** | M2 (with Lists) |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (property), F09 (vendors), F08 (lists), F33 (taxonomies/attributes), F34 (events), F06 (order task) |
| **Spec references** | SPEC §7.15 (lists); user request (this turn) |

> **Decisions (revisitable):** a **Products/Supplies domain for consumables** (eggs, shower gel) — distinct from the asset registry (durables) — with **preferred spec/brand**, **preferred vendors + buy links**, and **stock status** (in_stock / low / out) + par levels. Marking a product **out/low** emits `product.out_of_stock` (F34) → auto-proposes a **Lists** item (F08) with the spec + preferred vendor buy-link → approve → order task. Uses F33 taxonomies/attributes. Durables' "in stock" stays as owned+located/custody in the registry.

## 1. Purpose & user value
"We're out of eggs — the Burford Brown ones, get them from Harrods." A persistent catalogue of the things the household keeps in stock, with the *right* brand/spec and *where to buy*, so anyone can flag a shortage and it turns into an approved, correctly-specified order without re-explaining preferences each time.

## 2. Roles & permissions
Resource `product` (property-scoped, F02): **Principal/Manager** `write` (manage catalogue, preferences); **Staff** `write` to **mark out/low** + propose, `read` their property's products. 

## 3. Data model
`V__products.sql`:
- **`products`** — `id, owner_id, property_id uuid null → properties, name text (e.g. "Eggs"), preferred_spec text null (e.g. "Burford Brown, large"), preferred_brand text null, unit text null, stock_status text ('in_stock'|'low'|'out') default 'in_stock', par_level numeric null, reorder_qty numeric null, notes text null, attributes jsonb default '{}' (F33), created_at, updated_at, deleted_at`. Categorised via **F33 taxonomies** (e.g. Groceries › Eggs) + tags.
- **`product_vendors`** — `id, product_id → products, vendor_id uuid null → vendors, vendor_name text null (free-text if not a tracked vendor, e.g. "Harrods"), buy_url text null, preferred bool, last_price_minor bigint null, currency text null, note`.
- **`product_stock_events`** — `id, product_id, status text, qty_delta numeric null, at timestamptz, by uuid, note` (stock history; also emits F34 events).

## 4. API
`GET /api/products?property=&status=` · `GET /:id` · `POST` · `PATCH` · `POST /:id/stock` (set in_stock/low/out → emits event, may auto-create a list item) · `DELETE`. Product-vendors CRUD (preferred + buy links).

## 5. UI / screens & states
- **Products / Supplies view** (per property): grouped by taxonomy; rows show name, preferred spec, **stock chip** (in-stock/low/out), preferred vendor + **buy link**, par level. Quick **"Mark out of stock"** → buy request.
- **Product detail**: spec/brand, preferred vendors (+ buy URLs, prices), stock history, custom fields/tags (F33), par/reorder.
- **Integrates with Lists (F08)**: out/low auto-proposes the list item (with spec + preferred buy-link); the Lists "needs-approval" flow approves it.
- States: in-stock, low (amber), out (red, buy-requested), ordered, restocked.

## 6. Business rules & validation
- **Out/low → buy request**: setting `stock_status='out'` (or hitting `par_level`) emits `product.out_of_stock` (F34) → **proposes a Lists item** (F08) on the property's supplies list, pre-filled with `preferred_spec` + the **preferred vendor's `buy_url`** (e.g. Harrods) → Principal approves → order task (F06). **Dedup**: don't add if already pending on a list.
- **Preferred vendor**: one `preferred` vendor per product drives the auto-suggested buy link; others are alternatives.
- **Restock**: ordering/marking in-stock resets status (and may roll a recurring supply, F08).
- **Scope**: products are property-scoped; staff mark out/low on their property.
- **Consumables vs durables**: products = consumables; a one-off durable purchase still goes through assets (F04). The taxonomy/attributes/tags are shared via F33.

## 7. Integrations
F08 (auto list item / order), F09 (preferred vendors + links), F33 (categorise/attributes), F34 (stock events → notifications), F06 (order task), F23 (low-stock nudges optional).

## 8. Edge cases
Out twice before ordering (dedup); preferred vendor untracked (free-text "Harrods" + URL); multi-property products; par-level automation vs manual; price drift on the buy link; product later promoted to a tracked asset (rare); seasonal items.

## 9. Acceptance criteria
- **AC1** Create product "Eggs" with preferred spec "Burford Brown, large" and a preferred vendor "Harrods" + buy URL.
- **AC2** A staff member marks Eggs **out** → a Lists buy request appears pre-filled with the spec + Harrods link → Principal approves → order task created.
- **AC3** Marking out twice doesn't duplicate the pending list item.
- **AC4** Products are categorised via a user-defined taxonomy (F33) and carry custom fields/tags.
- **AC5** Stock status + history render; restock resets to in-stock.
- **AC6** Staff act only on their property's products.

## 10. Test plan
Backend (weaver+PG): stock transitions + event emission; out→list-item auto-propose + dedup; preferred-vendor buy-link selection; par-level trigger; scope. Web: Vitest products view + stock chips + mark-out; Playwright eggs end-to-end (out → list → approve → task).

## 11. Observability & audit
Audit: product CRUD, stock changes, vendor-link changes. Metrics: out/low counts by property, reorder cycle time, buy-request → order conversion, most-reordered products.

## 12. Open questions
1. Auto-add to list on `out` vs propose-only (lean: propose into needs-approval). 2. Par-level automation depth. 3. Price tracking on buy links (manual vs scrape — likely manual). 4. Whether a "low" threshold auto-orders for true staples.
