import { z } from "zod";
import { api } from "./http";

/** F23/F29 — registry-health aggregate (% of assets meeting each completeness check). */
export const RegistryHealthSchema = z.object({
  total: z.number(),
  photographedPct: z.number(),
  categorisedPct: z.number(),
  locatedPct: z.number(),
  proofPct: z.number(),
});
export type RegistryHealth = z.infer<typeof RegistryHealthSchema>;

/** F23 — an open data-quality flag. */
export const QualityFlagSchema = z.object({
  id: z.string(),
  assetId: z.string().nullable(),
  assetTitle: z.string().nullable(),
  kind: z.string(),
  severity: z.string(),
});
export type QualityFlag = z.infer<typeof QualityFlagSchema>;
const ScanResultSchema = z.object({ flagsRaised: z.number() });
const OkSchema = z.object({ ok: z.boolean() });

export const getRegistryHealth = (token: string | null) => api("/api/insights/registry-health", RegistryHealthSchema, { token });
export const listQualityFlags = (token: string | null) => api("/api/data-quality", z.array(QualityFlagSchema), { token });
export const runScan = (token: string | null) => api("/api/data-quality/scan", ScanResultSchema, { method: "POST", token });
export const resolveFlag = (id: string, token: string | null) => api(`/api/data-quality/${id}/resolve`, OkSchema, { method: "POST", token });
