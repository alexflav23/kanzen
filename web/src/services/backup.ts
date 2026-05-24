import { z } from "zod";
import { api } from "./http";

/** F30 — the self-descriptive archive manifest (object counts + per-section sha256). */
export const ManifestSchema = z.object({
  export_version: z.string(),
  schema_version: z.string(),
  object_counts: z.record(z.string(), z.number()),
  section_checksums: z.record(z.string(), z.string()),
});
export type Manifest = z.infer<typeof ManifestSchema>;

// the data block holds dependency-ordered entity sections; kept opaque for round-tripping
const ArchiveSchema = z.object({ manifest: ManifestSchema, data: z.record(z.string(), z.array(z.unknown())) });
export type Archive = z.infer<typeof ArchiveSchema>;

export const ExportResultSchema = z.object({ jobId: z.string(), manifest: ManifestSchema, archive: ArchiveSchema });
export type ExportResult = z.infer<typeof ExportResultSchema>;
export const ValidateResultSchema = z.object({ valid: z.boolean(), errors: z.array(z.string()) });
export type ValidateResult = z.infer<typeof ValidateResultSchema>;
export const RestoreResultSchema = z.object({
  mode: z.string(),
  applied: z.record(z.string(), z.number()),
  wouldApply: z.record(z.string(), z.number()),
});
export type RestoreResult = z.infer<typeof RestoreResultSchema>;

export const runExport = (token: string | null) => api("/api/backup/export", ExportResultSchema, { method: "POST", token });
export const validateArchive = (token: string | null, archive: Archive) =>
  api("/api/backup/validate", ValidateResultSchema, { method: "POST", token, body: { archive } });
export const restoreDryRun = (token: string | null, archive: Archive) =>
  api("/api/backup/restore", RestoreResultSchema, { method: "POST", token, body: { archive, mode: "dry_run" } });
