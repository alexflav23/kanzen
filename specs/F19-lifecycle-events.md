# Feature F19 — Asset lifecycle events & timeline

| | |
|---|---|
| **Feature ID** | F19 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets), F03 (location/custody history), F05 (docs), F09 (parties); feeds F18 (postings), F20 (valuation), F29 (lifetime cost) |
| **Spec references** | SPEC §8.4, §8.5; `input/views/asset-detail.jsx → TimelineTab`, App. E.6 |

> **Decisions (revisitable):** a typed **event timeline** is the heart of asset detail; each event may carry cost, documents, comment, condition delta, valuation delta, party, and location/custody change; service costs become **associated costs** (F17) and feed **lifetime cost**; move/custody events write the F03 history tables.

## 1. Purpose & user value
Every asset's life, in one chronological view — acquired, used, moved, cleaned, serviced, damaged, appraised, insured, sold. The provenance archive that makes the registry "kanzen", and the source of lifetime cost and valuation history.

## 2. Roles & permissions
Resource `asset_event` (Principal-private with Manager operational): **Manager** `write` operational events + service costs (not valuation-delta events, which are Principal, F02/F20); **Principal** `admin`; **Staff** `none`.

## 3. Data model
`V__asset_events.sql`:
- **`asset_events`** — `id, owner_id, asset_id → assets, type text (acquired|first_use|moved|cleaned|dry_cleaned|repaired|restored|serviced|damaged|condition_up|condition_down|appraised|insured|listed|sold|gifted|lost|stolen|archived|comment), occurred_at timestamptz, cost_minor bigint null, currency null, party_id uuid null → vendors, document_ids uuid[], note text null, condition_from text null, condition_to text null, valuation_delta_minor bigint null, location_id uuid null, custody_state text null, created_by, created_at`.
- Move/custody events write `asset_location_history`/`asset_custody_history` (F03); cost-bearing events optionally create an `associated_cost` (F17); valuation events create a snapshot (F20).

## 4. API
`POST /api/assets/:id/events` · `GET /api/assets/:id/timeline` · `PATCH`/soft-`DELETE` event · `GET /api/event-types`.

## 5. UI / screens & states
Fills the F04 **Timeline tab** (App. E.6): vertical spine + typed colour-coded **event dots** (acquired=accent, valuation/appraisal=green, service/cleaning=cyan, moved/custody=purple, damage=red, document=grey), cost/party/value-delta pills; "Log an event" quick action (type, date, cost, party, docs, condition/valuation delta, location/custody). States: empty, populated, filtered.

## 6. Business rules & validation
- Event types drive side-effects: `moved`→location history; custody change→custody history; cost→associated cost→ledger (F18) + lifetime cost; `appraised`/value delta→valuation snapshot (F20); `sold`/`gifted`/`lost`/`stolen`→`ownership_status` + realised value; `damaged`/`condition_*`→condition + data-quality (F23).
- Retroactive events allowed (dated in the past), re-sorted; immutable documents attached.
- Lifetime cost = acquisition + sum(cost events) (Insights F29 / asset hero).

## 7. Integrations
F03 (location/custody), F05 (docs), F09 (parties), F17 (associated cost), F18 (postings), F20 (valuation), F23 (condition→quality).

## 8. Edge cases
Out-of-order/retroactive events; cost event without a receipt (manual); disposal (sold) closing the asset; condition downgrade; party not yet a vendor (create); event editing (audit, supersede).

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Service event creates timeline entry, associated cost, and ledger posting**  ‹maps: `ServiceEventIT`, web `asset-detail.spec` timeline›
- **Given** a guitar asset with no events
- **When** Lorna logs a `serviced` event with a cost (£150 GBP), vendor (a luthier), and an attached receipt document
- **Then** a timeline entry appears with the correct type dot (cyan), cost pill, and party name
- **And** an `associated_cost` row (F17) is created, lifetime cost in the asset hero updates, and a ledger posting (F18) is recorded; the attached document is immutable.

**AC2 — "Moved" event writes location history and updates current location**  ‹maps: `MovedEventIT`, web `asset-detail.spec` move›
- **Given** a watch asset located at *Wardian – Study – Cabinet*
- **When** Toby logs a `moved` event to *Wardian – Master Bedroom – Safe*
- **Then** an `asset_location_history` row is written with the old and new location and `moved_by = Toby`
- **And** the asset's `location_id` is updated and the Timeline tab shows the move entry at the correct chronological position.

**AC3 — "Sold" event closes the asset with realised value**  ‹maps: `SoldEventIT`, web `asset-detail.spec` sold›
- **Given** an asset with `ownership_status = owned`
- **When** Toby logs a `sold` event with a realised value and party
- **Then** `ownership_status` → `sold`, the asset is visually closed in the Inventory, and the realised value is recorded
- **And** the event is audited and Lifetime Cost (F29) reflects the sale.

**AC4 — Manager cannot log valuation-delta events (negative)**  ‹maps: `EventAuthzIT`›  *(invariant: valuation is Principal-private; default-deny)*
- **Given** a watch asset
- **When** Lorna (Manager) attempts to log an `appraised` event with a `valuation_delta_minor` field
- **Then** the request is **rejected (403)** — valuation-delta events require Principal permission (F02/F20)
- **And** Lorna can still log operational events (`serviced`, `cleaned`, `moved`) without restriction.

**AC5 — Retroactive event is re-sorted into the timeline**  ‹maps: `RetroactiveEventIT`, web `asset-detail.spec` retroactive›
- **Given** a guitar asset with a 2025 service event at the top of the timeline
- **When** Toby logs a backdated `acquired` event with `occurred_at` in 2019
- **Then** the event is inserted at the correct chronological position in the timeline, not appended at the top
- **And** lifetime cost correctly accounts for the acquisition in the rollup order.

**AC6 — Custody change event writes custody history**  ‹maps: `CustodyEventIT`›
- **Given** a watch asset with `custody_status = with_owner`
- **When** Toby logs a custody-change event with `custody_state = with_repair_shop` and a vendor party
- **Then** an `asset_custody_history` row is written with the new state, party, and actor
- **And** the asset detail reflects `custody_status = with_repair_shop`.

**AC7 — Staff cannot access lifecycle events (negative)**  ‹maps: `EventStaffAuthzIT`›  *(invariant: registry Principal-private; default-deny)*
- **Given** Marcia (Wardian Staff)
- **When** she attempts `GET /api/assets/:id/timeline` or `POST /api/assets/:id/events`
- **Then** she receives **403** on both — Staff have no permission on `asset_event`.

## 10. Test plan
Backend (weaver+PG): event side-effects (location/custody/associated-cost/valuation/ownership), retroactive ordering, field-level (valuation) permission, lifetime-cost rollup. Web: Vitest TimelineTab + log-event; Playwright service-event→lifetime-cost.

## 11. Observability & audit
Audit: every event create/edit/delete. Metrics: events by type, service spend per asset, disposals.

## 12. Open questions
1. Associated-cost auto-create on cost events vs prompt (ties F17). 2. Event templates per vertical (e.g. watch service vs guitar setup). 3. Bulk event entry for legacy (F24).
