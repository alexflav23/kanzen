# Feature F05 — Documents (in-house S3 evidence store)

| | |
|---|---|
| **Feature ID** | F05 |
| **Milestone** | M1 |
| **Domain** | Documents |
| **Status** | ✅ spec complete |
| **Depends on** | F02 (authz), F03 (property scope); foundation for F13 (receipts/OCR), used by F04/F19/F25 |
| **Spec references** | SPEC §3.2, §7.7, §12; `input/views/stubs.jsx → DocumentsView`, App. E.9 |

> **Decisions (this feature):** documents are **owned in-house in S3** (not Drive) — **originals immutable**, derived data versioned; polymorphic attachment to assets/transactions/properties/people/vendors; a **Principal-private subset** the Manager cannot see (§4). Receipts/invoices and the **OCR parse pipeline build on this in F13**.

---

## 1. Purpose & user value
One trustworthy evidence store for everything the household keeps as proof — receipts, invoices, warranties, appraisals, statements, insurance, contracts, HR docs. Originals are sacred and immutable; everything (assets, transactions, properties, people) attaches to them. It's the substrate for the registry's "source documents are sacred" principle and for backup/restore.

## 2. Roles & permissions
Resource `document` (+ a `document.private` sensitivity), property-scoped (F02):
- **Principal** — `admin`, including the **private document index** (personal/legal).
- **Manager** — `write` on household documents (upload, classify, attach) **except** Principal-private documents (denied; not even listed) — SPEC §4.
- **Staff** — scoped `read` on their property's non-private documents only where a rule grants it; no registry/finance documents.
- Download is via short-lived presigned URLs, authorised per request.

## 3. Data model
`V__documents.sql` (Flyway version assigned at M1 build order):

- **`documents`** — `id uuid pk`, `owner_id`, `name text`, `category text` (`receipt`/`invoice`/`warranty`/`appraisal`/`statement`/`insurance`/`service`/`legal`/`hr`/`other`), `content_type text`, `size_bytes bigint`, `s3_key text`, `sha256 text`, `immutable bool default true`, `visibility text` (`household`/`principal_private`), `source text` (`manual`/`agent`/`import`), `property_id uuid null` (scope), `uploaded_by uuid`, `uploaded_at timestamptz`, `created_at`, `deleted_at null` (soft-delete metadata only — the **original object is never deleted** except by an explicit purge job).
- **`document_versions`** — `id uuid pk`, `document_id → documents`, `kind text` (`original`/`preview`/`thumbnail`/`ocr_text`), `s3_key`, `content_type`, `sha256`, `created_at`. The `original` is write-once; previews/derived are regenerable. (Receipt **parse runs** — the versioned *extracted line items* — are a richer F13 structure that references the document.)
- **`document_links`** — polymorphic: `id`, `document_id`, `target_type text` (`asset`/`bank_transaction`/`property`/`person`/`vendor`/`reminder`/`maintenance_log`/`receipt`/`defect`), `target_id uuid`, `role text null` (`proof`/`warranty`/`appraisal`/`coverage`/`provenance`), `created_at`. A document links to many targets; a target has many documents.
- **Indexes**: `documents(category)`, `documents(property_id)`, GIN/trigram on `name`; `document_links(target_type, target_id)`.

## 4. API (Tapir endpoints)
- `POST /api/documents` — upload (multipart or presigned PUT): stream to S3, compute `sha256`, store metadata, kick async preview generation. Returns the document.
- `GET /api/documents` — list/filter (`category`, `source`, `attached_to`, `visibility`, `q`; paginated; private docs filtered by F02).
- `GET /api/documents/:id` — metadata. `GET /api/documents/:id/download` — short-lived presigned URL (authorised). `GET /api/documents/:id/preview` — preview/thumbnail.
- `PATCH /api/documents/:id` — classify/rename, set visibility (Principal only for `principal_private`).
- `POST /api/documents/:id/links` · `DELETE /api/documents/:id/links/:linkId` — polymorphic attach/detach.
- `DELETE /api/documents/:id` — **soft delete** (metadata; original retained). Hard purge is a separate, audited Principal-only job.
- *(Receipt-specific parse endpoints live in F13; the agent's email-attachment ingestion in F25 calls `POST /api/documents`.)*

## 5. UI / screens & states
Per `DocumentsView` + App. E.9, and consumed by the Property/Asset Documents tabs:
- **Documents module**: summary tiles (total documents, storage used incl. derived versions, parse runs/30d†, line items/30d†) (†from F13); search + **category** segmented filter; table rows showing the **immutable-original** lock, parse-run/line-item counts†, **attached-to** (polymorphic target), and **source** (agent ribbon vs manual). **Upload** CTA.
- **States**: uploading (progress), preview-pending, ready, error (unsupported type, too large, scan-failed), empty; private-doc rows hidden from the Manager.
- **Embedded**: Property Bible → Documents tab; Asset detail → Documents tab (filtered to that target).

## 6. Business rules & validation
- **Immutable originals.** The `original` object is write-once; no overwrite/replace. Corrections are *new* documents or *derived* versions, never edits to the original. Soft-delete hides metadata but keeps the object; purge is explicit + audited.
- **Integrity.** `sha256` stored on upload and verified on download/backup; included in the export manifest (§12).
- **Dedup.** Identical `sha256` upload → offer to link the existing document rather than duplicate (configurable).
- **Visibility.** `principal_private` documents are invisible to Manager/Staff (not listed, not downloadable) — enforced server-side (F02).
- **Scope.** Property-bound documents respect `property_scopes`.
- **Storage.** S3 bucket `kanzen-docs.{env}.eu-west-1.hypervolt`; key layout `documents/{owner}/{yyyy}/{id}/original.{ext}`, previews under `.../preview.*`. Server-side encryption; optional **S3 Object Lock / versioning** for hard immutability (see Open Questions).
- **Previews** generated async (PDF→image, image→webp); failure is non-fatal (original still usable).

## 7. Integrations / external systems
- **S3** (F00 `ObjectStore`): put/get/presign; LocalStack locally. SSE; optional Object Lock.
- **Bedrock** (F13): the OCR/parse pipeline reads the original; **not** part of F05.
- **Gmail agent** (F25): files email attachments via `POST /api/documents` (source=`agent`).
- **Backup** (F30): exports originals + checksums.
- **Google Drive**: **export-only/optional**, never a store (SPEC §3.2).

## 8. Edge cases
- Very large files / unsupported MIME → bounded + clear error; original still stored if type is allowed.
- Duplicate upload (same sha256) → link-or-duplicate prompt.
- Preview generation fails → original remains downloadable; retry job.
- Manager tries to open a Principal-private document → 403/404 (not even listed).
- Orphan document (no links) → allowed; surfaced as a data-quality nudge (F23) for receipts.
- Soft-deleted document still referenced by a link → link shows "document removed"; original retained for audit.
- Scope: a Singapore-scoped user can't see Wardian property documents.
- Presigned URL leakage → short TTL + per-request authorisation; no public objects.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Upload a receipt: immutable original stored and checksummed**  ‹maps: `DocumentUploadIT`, web `documents.spec` upload›  *(invariant: source documents are sacred — immutable originals)*
- **Given** Lorna is on the Documents upload screen
- **When** she uploads a PDF receipt
- **Then** the original is stored in S3 at the expected key path, `sha256` is recorded, `immutable = true`, and the document is listed with `category = receipt` and `source = manual`
- **And** any attempt to overwrite the original S3 object is **rejected** — corrections require a new document or derived version.

**AC2 — Polymorphic attachment**  ‹maps: `DocumentLinkIT`, web `documents.spec` attach›
- **Given** a document already in the store
- **When** Lorna attaches it to both an asset and a bank transaction via `POST /api/documents/:id/links`
- **Then** the asset detail Documents tab and the transaction detail both list the document
- **And** the `document_links` table has two rows with the correct `target_type`/`target_id` combinations.

**AC3 — Principal-private documents invisible to Manager**  ‹maps: `DocumentVisibilityIT`, web `documents.spec` visibility›  *(invariant: server-side scope; no leak)*
- **Given** Toby uploads a legal document with `visibility = principal_private`
- **When** Lorna (Manager) calls `GET /api/documents` or `GET /api/documents/:id` for that document
- **Then** it is **not listed** in Lorna's results and the direct fetch returns **403/404** — existence is not leaked
- **And** Toby (Principal) can list and download it normally.

**AC4 — Download via short-lived presigned URL**  ‹maps: `DocumentPresignIT`, web `documents.spec` download›  *(invariant: no public S3 objects)*
- **Given** a document stored in S3
- **When** Toby requests `GET /api/documents/:id/download`
- **Then** he receives a short-lived presigned URL (per-request authorisation)
- **And** the S3 object has no public ACL; the URL expires within the configured TTL.

**AC5 — Soft-delete preserves the original**  ‹maps: `DocumentSoftDeleteIT`›  *(invariant: source documents are sacred)*
- **Given** a document with `immutable = true`
- **When** Lorna soft-deletes it via `DELETE /api/documents/:id`
- **Then** `deleted_at` is set and the document no longer appears in listings
- **And** the S3 original **still exists**; `sha256` verification against the original still passes; any linked targets show "document removed".

**AC6 — Deduplication: identical sha256 prompts link**  ‹maps: `DocumentDedupIT`›
- **Given** a document already stored with a known `sha256`
- **When** Toby uploads a file with the same checksum
- **Then** the API returns a dedup prompt offering to link the existing document rather than creating a duplicate
- **And** accepting the prompt creates a `document_link` to the existing document; no second S3 object is created.

**AC7 — Property scope: Singapore user cannot see Wardian documents**  ‹maps: `DocumentScopeIT`, web `documents.spec` scope›  *(invariant: property scope enforced server-side)*
- **Given** Siti (Singapore Staff)
- **When** she lists documents or attempts to fetch a Wardian-scoped document by ID
- **Then** the listing returns **only** her property's documents and the direct fetch returns **403/404** — Wardian document existence is not leaked.

**AC8 — Agent-sourced document recorded with correct provenance**  ‹maps: `DocumentAgentSourceIT`›  *(invariant: agent proposes, source docs immutable)*
- **Given** The Agent files an email attachment via `POST /api/documents` with `source = agent`
- **When** the document is stored
- **Then** `source = agent` is recorded and the agent ribbon appears in the Documents module row
- **And** the original is immutable and subject to the same visibility/scope rules as any other document.

## 10. Test plan
- **Backend** (weaver + testcontainers-PG + **LocalStack S3**): upload→S3→metadata→sha256; immutability (overwrite rejected); polymorphic link/unlink; visibility filtering (Manager vs Principal); scope filtering; presigned-URL TTL + auth; dedup; soft-delete retains object.
- **Web**: Vitest for the documents table + upload states + category filter; Playwright e2e upload + attach + private-doc invisibility (Manager vs Principal).
- **Integrity**: checksum verify on download; backup-manifest checksum (with F30).

## 11. Observability & audit
- Audit: upload, classify, attach/detach, visibility change, soft-delete, purge.
- Metrics: documents by category/source, storage bytes, preview-gen success/latency, presigned-URL issuance, dedup hits.

## 12. Open questions / decisions
1. **Hard immutability** — app-level write-once (lean) vs **S3 Object Lock (WORM)** / bucket versioning for a regulatory-grade guarantee. *(Lean: app-level + SSE now; Object Lock optional for annual snapshots, §12.5.)*
2. **Preview generation infra** — in-backend job vs a dedicated Lambda (PDF rendering deps). 
3. **Virus/malware scan** on upload (agent-ingested attachments especially) — add a scan step? *(Lean: yes for agent-sourced.)*
4. **Dedup default** — auto-link identical sha256 vs always prompt.
5. **OCR text as a `document_version`** vs living entirely in F13's parse-run model. *(Lean: F13 owns parse runs; F05 may store a plain `ocr_text` version for search.)*
