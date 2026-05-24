# Feature F09 — Vendors & contacts

| | |
|---|---|
| **Feature ID** | F09 |
| **Milestone** | M2 |
| **Domain** | Operations |
| **Status** | ✅ spec complete |
| **Depends on** | F03 (property approval scope), F02 (authz); used by F08, F11, F15, F19 |
| **Spec references** | SPEC §7.11; `input/views/stubs.jsx → VendorsView`, App. E.13 |

> **Decisions (revisitable):** vendors are businesses **or** individuals relevant to the household and to assets; **approval is property-scoped**; **NDA + insurance status carry expiry** with reminders; vendors hold **asset/service roles** (dealer, luthier, appraiser, gift recipient, borrower, restorer); an expired-insurance vendor is **blocked from new maintenance assignment** (F11).

## 1. Purpose & user value
The trusted directory behind everything that touches the household and its assets — who services the boiler, who appraises the watches, which dealer sold the guitar — with the compliance facts (NDA, insurance, rating) that decide who's allowed to do what, where.

## 2. Roles & permissions
Resource `vendor` (property-scoped approval, F02): **Principal/Manager** `write`; **Staff** `read` vendors approved for their property; sensitive contract/rate fields may be Manager+ only.

## 3. Data model
`V__vendors.sql`:
- **`vendors`** — `id, owner_id, name, type ('business'|'individual'), trade text, contacts jsonb (phones/emails/addresses), rate_notes text null, contract_terms text null, nda_status text, nda_until date null, insurance_status text, insurance_until date null, rating numeric null, notes text null, attributes jsonb default '{}' (freehand custom fields, F33), created_at, updated_at, deleted_at`. Vendors also support polymorphic **tags** and **user-defined taxonomies** (e.g. a custom "warranty portal URL" field or a "Trade" taxonomy) via F33.
- **`vendor_property_link`** — `(vendor_id, property_id)` — approval scope.
- **`asset_party_link`** — `(asset_id, vendor_id, role)` `role ∈ dealer/auctioneer/retailer/appraiser/restorer/luthier/gift_recipient/borrower` — provenance & service roles (populated from F19 events too).
- Links to `maintenance_plans`/`maintenance_logs` (F11), `bills` (F15), `defects` (F03).

## 4. API
`GET /api/vendors` (filter trade/property/status) · `GET /:id` (history: maintenance, bills, asset roles) · `POST` · `PATCH` · `DELETE` · `POST /:id/properties` (approve for property) · expiry reminder hooks (NDA/insurance via F11 engine).

## 5. UI / screens & states
Per `VendorsView`: table (vendor, trade, properties, **NDA expiry**, **insurance expiry**, rating; warning row when expired). Vendor detail: contacts, contract/rate, compliance with expiry pills, linked maintenance/bills/asset-roles history. States: approved/expired-compliance (amber/red), empty.

## 6. Business rules & validation
- **Property-scoped approval**: a vendor is only selectable (e.g. in add-maintenance F11) for properties it's approved for **and** with non-expired insurance.
- **Compliance expiry**: NDA/insurance `*_until` generate reminders (F11) + Inbox + dashboard "expiring within 60 days"; expired insurance flags the vendor and blocks new assignment.
- **Roles**: a vendor may hold many asset roles; provenance roles are immutable history.
- **Individual vs business**: individuals (e.g. an appraiser) supported.

## 7. Integrations
F11 (maintenance assignment + expiry reminders), F08 (list delivery vendor), F15 (bills payee link), F19 (asset provenance/service events). No external systems.

## 8. Edge cases
Expired insurance mid-plan (warn, don't auto-cancel); vendor across multiple properties; merging duplicate vendors; deleting a vendor with history (soft-delete, retain links); rating history.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Vendor with valid insurance is selectable; expired insurance blocks assignment**  ‹maps: `VendorInsuranceBlockIT`, web `vendors.spec` selectability›
- **Given** two vendors approved for Wardian — one with valid insurance and one with an expired `insurance_until` date
- **When** Lorna opens the maintenance assignment picker for a Wardian job (F11)
- **Then** the vendor with valid insurance is selectable
- **And** the vendor with expired insurance is **blocked** with a clear "Insurance expired" reason — it cannot be assigned.

**AC2 — Compliance expiry surfaces in Inbox and dashboard**  ‹maps: `VendorExpiryReminderIT`, web `vendors.spec` expiry-pills›
- **Given** a vendor whose NDA expires within 60 days and another whose insurance expires within 60 days
- **When** the reminder engine runs (F11)
- **Then** both appear in the Inbox + the dashboard "expiring within 60 days" section with amber pills
- **And** once the date passes, the vendor row turns red and new maintenance assignment for affected properties is blocked.

**AC3 — Vendor history: maintenance, bills, and asset roles**  ‹maps: `VendorHistoryIT`, web `vendors.spec` detail›
- **Given** a vendor linked to completed maintenance jobs, billed invoices, and asset provenance roles (dealer, appraiser)
- **When** Lorna opens the vendor detail
- **Then** she sees all linked maintenance logs, bills, and asset-role entries in the history panels
- **And** provenance roles (dealer, auctioneer) are shown as **immutable history** — they cannot be deleted.

**AC4 — Property-scoped approval: Staff see only their property's vendors**  ‹maps: `VendorScopeIT`, web `vendors.spec` scope›  *(invariant: default-deny; property scope enforced server-side)*
- **Given** Marcia (Wardian Staff) and a vendor approved for Singapore only
- **When** Marcia lists vendors
- **Then** she sees only vendors with a `vendor_property_link` to Wardian — the Singapore-only vendor is **not listed**
- **And** Siti (Singapore Staff) conversely sees only Singapore-approved vendors; neither can see the other's list.

**AC5 — Vendor creation and approval (Manager/Principal write)**  ‹maps: `VendorCreateApproveIT`, web `vendors.spec` create›
- **Given** Lorna is on the Vendors screen
- **When** she creates a new vendor (business, trade: plumber) and approves it for Wardian via `POST /api/vendors/:id/properties`
- **Then** the vendor appears in the Wardian-scoped vendor list with an active status
- **And** the creation and approval actions are both audited.

**AC6 — Staff cannot create or edit vendors (negative)**  ‹maps: `VendorAuthzIT`›  *(invariant: default-deny)*
- **Given** Marcia (Wardian Staff)
- **When** she attempts `POST /api/vendors` or `PATCH /api/vendors/:id`
- **Then** she receives **403** — Staff have read-only access to approved vendors for their property.

**AC7 — Soft-delete a vendor with history (edge)**  ‹maps: `VendorSoftDeleteIT`›
- **Given** a vendor with linked maintenance logs and bill references
- **When** Lorna soft-deletes the vendor
- **Then** `deleted_at` is set and the vendor no longer appears in active listings
- **And** all historical links (maintenance, bills, asset roles) are **retained** and remain visible in the audit trail — no orphaned references.

## 10. Test plan
Backend: property-scoped selectability, insurance-expiry block, role links, soft-delete with history. Web: Vitest vendor table/compliance pills; Playwright approve-for-property + expiry warning.

## 11. Observability & audit
Audit: vendor CRUD, approval, compliance changes, rating. Metrics: vendors by trade/property, expiring-compliance count.

## 12. Open questions
1. Field-level sensitivity on rates/contracts (Manager vs Principal). 2. Vendor merge tooling. 3. Whether ratings are manual or derived from maintenance outcomes.
