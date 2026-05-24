# Feature F30 — Backup, export & restore

| | |
|---|---|
| **Feature ID** | F30 |
| **Milestone** | M8 |
| **Domain** | Platform |
| **Status** | ✅ spec complete |
| **Depends on** | all domains (exports everything), F05 (S3 originals), F18 (ledger replay) |
| **Spec references** | SPEC §12, Appendix D; `input/views/backup.jsx`, App. E.15 |

> **Decisions (revisitable):** a **first-class, self-descriptive, portable export** of the whole system (relational + S3 originals + ledger history + audit + schema/version + manifest), restorable into a fresh install **without the original codebase**; **optional `age` encryption**; **annual immutable snapshots**; **restore with dry-run** in safe dependency order; daily RDS snapshots in addition.

## 1. Purpose & user value
Catastrophic-loss insurance and true data ownership — the household can take its entire estate (assets, finance, documents, ledger, audit) as one verifiable archive and rebuild from it anywhere. Backup/restore is a product feature, not a DB afterthought.

## 2. Roles & permissions
Resource `backup` — **Principal-only** (`admin`); Manager/Staff `none`. Restore is heavily guarded + audited.

## 3. Data model
`V__backup.sql`:
- **`export_jobs`** — `id, owner_id, mode ('full'|'selective'), status, started_at, finished_at, size_bytes, s3_key, encryption jsonb, manifest_id, error`.
- **`export_manifests`** — `id, export_version, application_version, schema_version, export_timestamp, owner_id, included_entity_types jsonb, object_counts jsonb, checksum_algorithm, file_index jsonb, encryption_status jsonb, restore_compatibility_notes jsonb` (Appendix D shape).
- **`restore_jobs`** — `id, source_archive, mode ('dry_run'|'full'), status, validation jsonb, applied jsonb, error, created_at`.
- **`backup_artifacts`** / **`archive_snapshots`** — annual immutable snapshots (read-only, integrity-verified; optional S3 Object Lock).

## 4. API
`POST /api/backup/export` (full; progress) · `GET /api/backup/jobs/:id` · `GET /api/backup/:id/manifest` · `GET /api/backup/:id/download` · `POST /api/backup/validate` (checksums + schema compat) · `POST /api/backup/restore` (`mode=dry_run|full`) · `POST /api/backup/snapshots` (annual/manual immutable).

## 5. UI / screens & states
Per `backup.jsx` (App. E.15): **Run full export** (live progress: snapshot tables → stream S3 docs → ledger history → manifest+checksums); **Last export** status (`dl`) + Download / View manifest / Restore dry-run; **Annual immutable snapshots** (read-only, integrity, download); inline **manifest.json** preview + entity counts; guarded **Restore** (upload / dry-run / restore-from-latest, danger styling). States: idle, exporting%, encrypted, restoring, dry-run-report, error.

## 6. Business rules & validation
- **Export** = top-level JSON manifest + entity data (JSON/JSONL) + **original binaries (S3)** + **ledger snapshot/replayable posting history** + audit + schema version, in a compressed (tar.gz/zip) archive; **sha256 per file**; optional **`age` encryption** with clear metadata.
- **Restore** validates manifest + checksums + **schema compatibility**, restores entities in **safe dependency order** (identity → properties → assets → finance → ledger → links), re-creates S3 objects, **replays/imports ledger consistently**, and supports a **dry-run** that reports what would change before any write.
- **Annual snapshots** are immutable/read-only, integrity-verified, preserve schema/version (for record-keeping/insurance/audit).
- **Self-descriptive**: understandable without the codebase (documented manifest + schema).

## 7. Integrations
All domains (export/import), F05/S3 (originals), F18/TigerBeetle (ledger replay), `age` (encryption), EventBridge (scheduled exports/snapshots), daily RDS snapshots (infra).

## 8. Edge cases
Huge archives (binaries inline vs sidecar — §19 open #2); partial/interrupted export (resumable); checksum mismatch on restore (abort); schema-version drift (compat notes + migration); restore into non-empty DB (guard); encryption key loss; ledger replay idempotency; S3 object restore conflicts.

## 9. Acceptance scenarios (UAT)
Actors per `specs/_acceptance-conventions.md`. Each scenario is automated (§10).

**AC1 — Full export produces a self-descriptive, verifiable archive**  ‹maps: `FullExportIT`, web `backup.spec` export-progress›
- **Given** Toby initiates a full export from the Backup screen
- **When** the export job completes
- **Then** the archive contains: the manifest (entity counts, schema version, checksums, restore notes), JSONL entity data, S3 original binaries, replayable ledger history, and audit log
- **And** the archive is optionally `age`-encrypted; each file has a sha256 checksum recorded in the manifest.

**AC2 — Validate verifies checksums and schema compatibility**  ‹maps: `BackupValidateIT`, web `backup.spec` validate›
- **Given** a downloaded archive (possibly from a previous application version)
- **When** Toby triggers Validate
- **Then** all sha256 checksums are verified; schema compatibility is assessed and any migration notes are surfaced
- **And** a tampered or incomplete archive fails validation with a clear, itemised error report.

**AC3 — Dry-run restore reports the plan without writing anything**  ‹maps: `RestoreDryRunIT`, web `backup.spec` dry-run›
- **Given** a validated archive
- **When** Toby runs **Restore dry-run**
- **Then** a report is returned listing every entity type and count that would be written, in dependency order
- **And** no rows are inserted or updated in the database; no S3 objects are written; the dry-run is audited.

**AC4 — Full restore round-trips faithfully into a fresh install**  ‹maps: `FullRestoreRoundTripIT`›  *(invariant: backup/restore must round-trip faithfully)*
- **Given** a fresh, empty database and the archive from AC1
- **When** a full restore runs (dependency order: identity → properties → assets → finance → ledger → links)
- **Then** all entities are recreated with relationships intact; S3 objects are re-created; the restored data matches the original row-for-row
- **And** the restore is audited with a summary of counts per entity type.

**AC5 — Ledger restores consistently and balances match**  ‹maps: `LedgerRestoreIT`›  *(invariant: backup/restore must round-trip faithfully)*
- **Given** the exported archive includes the full replayable TigerBeetle posting history
- **When** the ledger is replayed/imported during restore
- **Then** all account balances match the original snapshot; the ledger is self-consistent (debits = credits)
- **And** a mismatch aborts the restore and reports the discrepancy.

**AC6 — Annual immutable snapshot is read-only and integrity-verified**  ‹maps: `AnnualSnapshotIT`, web `backup.spec` snapshots›
- **Given** an annual snapshot is created (manual or scheduled)
- **When** Toby views it on the Backup screen
- **Then** it is listed as read-only (no delete/overwrite); integrity verification passes
- **And** the snapshot can be downloaded and validated; its schema version and entity counts are displayed.

**AC7 — Backup and restore are Principal-only; Manager/Staff are denied (negative)**  ‹maps: `BackupAuthzIT`›
- **Given** Lorna (Manager) attempts to initiate an export or restore
- **When** she calls `POST /api/backup/export` or `POST /api/backup/restore`
- **Then** she receives a 403; no job is created
- **And** each denied attempt is audited; Toby sees it in the audit log.

## 10. Test plan
Backend (weaver+PG+S3+TB): full export→restore **round-trip into a fresh DB** (the headline catastrophic-recovery test); checksum + schema-compat validation; dry-run plan; ledger replay equivalence; encryption round-trip; annual snapshot immutability. This feature gets **extra test rigor** (NFR §15).

## 11. Observability & audit
Audit: export, snapshot, validate, restore (dry-run + full). Metrics: export size/duration, checksum failures, restore success, snapshot cadence, last-successful-export age (alert if stale).

## 12. Open questions
1. **Binaries inline vs sidecar** in the archive (§19 #2). 2. Encryption key management/escrow. 3. Selective export scope (later). 4. Ledger export = snapshot vs full replayable history (lean: both).
