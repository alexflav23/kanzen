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

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Create product with preferred spec and vendor buy link**  ‹maps: `ProductCatalogueIT.create`, web `products.spec` create›
- **Given** Lorna is managing the Wardian supply catalogue
- **When** she creates product "Eggs" with preferred spec "Burford Brown, large", preferred vendor "Harrods" (free-text), and a buy URL
- **Then** the product is saved with `preferred_spec`, a `product_vendors` row with `preferred = true`, and the buy URL
- **And** the product is categorised via an F33 taxonomy (e.g. Groceries › Eggs) and carries custom attributes via `attributes jsonb`.

**AC2 — Staff marks out → Lists buy request auto-proposed (not auto-committed)**  ‹maps: `StockOutListProposalIT`, web `products.spec` mark-out, mobile `products_test.dart`›  *(invariant: agent/automation never auto-commits)*
- **Given** Marcia notices the eggs are gone and the product is `in_stock`
- **When** she taps **Mark out of stock**
- **Then** `stock_status` becomes `out`, a `product_stock_events` row is written, and a `product.out_of_stock` F34 event is emitted
- **And** a Lists item is **proposed** (status `needs_approval`) on the Wardian supplies list, pre-filled with the preferred spec and Harrods buy URL — it is **not** auto-approved or auto-ordered.

**AC3 — Marking out twice does not duplicate the pending list item**  ‹maps: `StockOutDedupIT`›
- **Given** a product already has a `needs_approval` list item pending
- **When** the stock is marked out a second time (e.g. by another staff member)
- **Then** no duplicate list item is created (dedup check on pending items)
- **And** the second stock event is still recorded in `product_stock_events`.

**AC4 — Approve → order task closes the buy-request cycle**  ‹maps: `ProductOrderCycleIT`, web `products.spec` e2e›
- **Given** a `needs_approval` list item was proposed from an out-of-stock event
- **When** Toby approves the list item and Lorna places the order
- **Then** a native order task (F06) is created for the assignee; the list item moves to `added` then the order cycle completes
- **And** restocking the product (marking `in_stock`) resets `stock_status` and is recorded in history.

**AC5 — Stock status and history render correctly**  ‹maps: `ProductStockHistoryIT`, web `products.spec` history›
- **Given** a product that has cycled through `in_stock → low → out → in_stock`
- **When** Toby opens the product detail
- **Then** the stock chip reflects the current status (in-stock/amber-low/red-out)
- **And** the full stock history (all `product_stock_events` rows) is visible with timestamps and actors.

**AC6 — Staff act only on their property's products (negative)**  ‹maps: `ProductScopeIT`, web `products.spec` scope, mobile `products_test.dart`›
- **Given** Marcia is Wardian-Staff and Singapore has its own product catalogue
- **When** she lists products
- **Then** she sees only Wardian products
- **And** a direct request for a Singapore product ID returns **403/404** — existence not leaked; she cannot create or delete products (only mark out/low).

**AC7 — Preferred vendor buy link drives auto-suggest**  ‹maps: `ProductPreferredVendorIT`›
- **Given** a product with two vendors — one preferred, one alternative
- **When** an out-of-stock event triggers a list item proposal
- **Then** the proposal uses the **preferred** vendor's `buy_url`
- **And** the alternative vendor's link is visible in the product detail as a secondary option.

## 10. Test plan
Backend (weaver+PG): stock transitions + event emission; out→list-item auto-propose + dedup; preferred-vendor buy-link selection; par-level trigger; scope. Web: Vitest products view + stock chips + mark-out; Playwright eggs end-to-end (out → list → approve → task).

## 11. Observability & audit
Audit: product CRUD, stock changes, vendor-link changes. Metrics: out/low counts by property, reorder cycle time, buy-request → order conversion, most-reordered products.

## 12. Open questions
1. Auto-add to list on `out` vs propose-only (lean: propose into needs-approval). 2. Par-level automation depth. 3. Price tracking on buy links (manual vs scrape — likely manual). 4. Whether a "low" threshold auto-orders for true staples.
