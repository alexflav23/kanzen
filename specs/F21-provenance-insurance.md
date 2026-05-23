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

## 9. Acceptance criteria
- **AC1** A watch shows provenance (dealer), authenticity (serial, box & papers), insurance (Hiscox policy, insured value — Principal-only), warranty (provider, expiry).
- **AC2** A lapsing warranty/insurance renewal surfaces as a reminder.
- **AC3** An expensive asset missing proof/insurance is flagged in data-quality.
- **AC4** Manager sees provenance/authenticity/warranty but not insurance/insured value.

## 10. Test plan
Backend (weaver+PG): warranty/insurance CRUD, expiry-reminder registration, missing-proof flagging, field-level insurance permission, insured-value↔snapshot link. Web: Vitest ProvenanceTab panels; Playwright add-warranty + Manager-denied insurance.

## 11. Observability & audit
Audit: warranty/insurance/provenance/authenticity changes. Metrics: insured %, expiring warranties/policies, assets missing proof.

## 12. Open questions
1. "Expensive" threshold for missing-proof flags. 2. Warranty transfer on disposal. 3. Insurer integration (data only — no carrier API, per non-goals).
