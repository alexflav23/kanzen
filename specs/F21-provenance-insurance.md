# Feature F21 — Warranty, provenance, authenticity & insurance

| | |
|---|---|
| **Feature ID** | F21 |
| **Milestone** | M5 |
| **Domain** | Assets |
| **Status** | ✅ spec complete |
| **Depends on** | F04 (assets), F05 (docs), F09 (parties), F20 (insured value), F11 (expiry reminders) |
| **Spec references** | SPEC §8.7; `input/views/asset-detail.jsx → ProvenanceTab`, App. E.6 |

> **Decisions (revisitable):** four panels — **warranty** (provider/dates/terms/docs), **provenance** (source/dealer/auction/prior-owner/restoration via party links), **authenticity** (serial/reference/box-&-papers/signed/certificates), **insurance** (insured flag/policy/insured-value/last-valuation/coverage docs). Insurance + insured value are **Principal-private**; warranty/provenance/authenticity are operational. Warranty/appraisal expiry → F11 reminders.

## 1. Purpose & user value
The trust dossier for high-value assets — proof of what it is, where it came from, that it's genuine, that it's covered, and what's guaranteed. Drives the "expensive asset missing proof/warranty/insurance" flags (F23) and insurance schedules.

## 2. Roles & permissions
`asset` provenance/authenticity/warranty = operational (Manager `write`); `insurance` + `insured_value` = **Principal-only** (F02/F20). Staff none.

## 3. Data model
`V__provenance_insurance.sql`:
- **`asset_warranties`** — `id, asset_id, provider, starts_on, ends_on, terms text, document_ids uuid[], created_at`.
- **`asset_insurance`** — `id, asset_id, insured bool, policy_ref text, insurer text (e.g. Hiscox), insured_value_minor bigint null, last_valuation_at date null, coverage_document_ids uuid[], renewal_on date null` (Principal-private).
- **Provenance** via `asset_party_link` (F09, roles dealer/auction/retailer/prior_owner/restorer) + `assets.attributes` (provenance notes) + documents.
- **Authenticity** via `assets.attributes` (serial/reference/box_and_papers/signed) + certificate documents (F05).

## 4. API
`GET/POST/PATCH /api/assets/:id/warranty` · `/insurance` (Principal) · provenance party links (F09) · authenticity fields (F04 attrs). Expiry reminders registered with F11.

## 5. UI / screens & states
Fills the F04 **Provenance & insurance tab** (App. E.6): four `meta-grid` panels — Provenance (acquired/source/cost/notes), Authenticity (serial/box-&-papers/signed), Insurance (insured value/policy/last appraisal — Principal), Warranty (provider/coverage/expires). States: complete vs missing (drives F23 flags).

## 6. Business rules & validation
- **Expiry reminders**: warranty `ends_on`, insurance `renewal_on`, appraisal recency → F11 reminders + Inbox + dashboard "expiring within 60 days" (prototype shows "Sonos warranty lapsed").
- **Missing-proof flags**: expensive assets (above a threshold) missing proof/warranty/insurance → data-quality (F23).
- **Insurance schedule**: sum of insured values = "Insured value" in Inventory/Insights (Principal).
- Insured value links to a valuation snapshot of kind `insured` (F20).

## 7. Integrations
F05 (certificates/coverage docs), F09 (provenance parties), F20 (insured value), F11 (expiry reminders), F23 (missing-proof flags).

## 8. Edge cases
Warranty transferable on sale; multiple coverage docs; provenance chain across owners; authenticity disputed; insurance lapse vs renewal; insured value drift vs market value.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Watch dossier: all four panels populated**  ‹maps: `ProvenanceInsuranceIT`, web `asset-detail.spec` provenance-tab›
- **Given** a watch asset with no provenance/warranty/insurance data
- **When** Toby fills in dealer (provenance party link), serial + box-&-papers (authenticity), Hiscox policy + insured value (insurance), and warranty provider + expiry
- **Then** all four `meta-grid` panels render with the correct values on the Provenance & insurance tab
- **And** each write is audited, and the insured value creates a linked F20 snapshot of kind `insured`.

**AC2 — Warranty expiry reminder registered**  ‹maps: `WarrantyExpiryReminderIT`›
- **Given** a warranty record with `ends_on` within 60 days
- **When** the reminder scan runs (F11)
- **Then** an expiry reminder appears in the Inbox and on the dashboard "expiring within 60 days" strip
- **And** a resolved or deleted warranty cancels its reminder.

**AC3 — Insurance renewal reminder registered**  ‹maps: `InsuranceRenewalReminderIT`›
- **Given** a Principal-private `asset_insurance` record with `renewal_on` within 60 days
- **When** the reminder scan runs (F11)
- **Then** Toby receives an Inbox reminder for the renewal
- **And** Lorna (Manager) receives **no** reminder (insurance is Principal-private).

**AC4 — Expensive asset missing proof/insurance flagged in data-quality**  ‹maps: `MissingProofFlagIT`, web inbox Vitest›
- **Given** a high-value asset (above the configured threshold) with no insurance record and no authenticity documents
- **When** the data-quality (F23) scan runs
- **Then** two flags appear in the Inbox data-quality stream: `expensive_no_proof` and `missing_proof`
- **And** adding an insurance record and a certificate document resolves the respective flags.

**AC5 — Manager sees provenance/authenticity/warranty; insurance/insured value denied (negative)**  ‹maps: `InsuranceAuthzIT`, web `asset-detail.spec` manager-insurance-denied›  *(invariant: insurance + insured_value are Principal-private; no leak via totals)*
- **Given** Lorna (Manager) viewing the Provenance & insurance tab of a watch
- **When** the page renders and she requests `/api/assets/:id/insurance`
- **Then** the Insurance panel is absent / returns **403**, and **insured_value is stripped from all asset responses** sent to Lorna — the Inventory insured-value total is also not shown to her
- **And** Lorna can read and edit the Provenance, Authenticity, and Warranty panels normally.

**AC6 — Staff has no access to provenance/insurance tab (negative)**  ‹maps: `ProvenanceStaffAuthzIT`›
- **Given** Marcia (Wardian Staff)
- **When** she requests `/api/assets/:id/warranty` or `/api/assets/:id/insurance`
- **Then** she receives **403** for both endpoints
- **And** no provenance, authenticity, warranty, or insurance data is included in any asset response she receives.

**AC7 — Insured value links to F20 valuation snapshot**  ‹maps: `InsuredValueLinkIT`›
- **Given** Toby sets an insured value of £12,000 on a watch's insurance record
- **When** the record is saved
- **Then** a valuation snapshot of kind `insured` is created/updated in F20 with that amount
- **And** the insurance schedule sum (Inventory/Insights "Insured value") reflects the new figure.

**AC8 — Provenance chain across multiple prior owners**  ‹maps: `ProvenanceChainIT`›
- **Given** an art piece with party links for an original gallery, an auction house, and a prior owner
- **When** Toby views the Provenance panel
- **Then** all three party links appear in acquisition-order with their roles (gallery/auction/prior_owner)
- **And** each link is independently editable and audited.

## 10. Test plan
Backend (weaver+PG): warranty/insurance CRUD, expiry-reminder registration, missing-proof flagging, field-level insurance permission, insured-value↔snapshot link. Web: Vitest ProvenanceTab panels; Playwright add-warranty + Manager-denied insurance.

## 11. Observability & audit
Audit: warranty/insurance/provenance/authenticity changes. Metrics: insured %, expiring warranties/policies, assets missing proof.

## 12. Open questions
1. "Expensive" threshold for missing-proof flags. 2. Warranty transfer on disposal. 3. Insurer integration (data only — no carrier API, per non-goals).
