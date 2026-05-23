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

## 9. Acceptance criteria
- **AC1** Logging a "serviced" event with a cost + vendor + doc adds a timeline entry, an associated cost (lifetime cost updates), and a ledger posting.
- **AC2** A "moved" event writes location history and updates current location.
- **AC3** A "sold" event sets ownership_status + realised value and closes the asset.
- **AC4** The timeline renders typed dots with cost/party/value-delta pills; Manager can't log valuation-delta events.

## 10. Test plan
Backend (weaver+PG): event side-effects (location/custody/associated-cost/valuation/ownership), retroactive ordering, field-level (valuation) permission, lifetime-cost rollup. Web: Vitest TimelineTab + log-event; Playwright service-event→lifetime-cost.

## 11. Observability & audit
Audit: every event create/edit/delete. Metrics: events by type, service spend per asset, disposals.

## 12. Open questions
1. Associated-cost auto-create on cost events vs prompt (ties F17). 2. Event templates per vertical (e.g. watch service vs guitar setup). 3. Bulk event entry for legacy (F24).
