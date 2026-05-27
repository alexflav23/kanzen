import { z } from "zod";
import { api } from "./http";

/** F19/W2 — the platform audited action log (mirrors api.Audit). Admin-only oversight of every audited write. */
export const AuditEntrySchema = z.object({
  id: z.string(),
  at: z.string(),
  actorType: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  detail: z.unknown(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export type AuditFilters = { limit?: number; before?: string; actor?: string; action?: string; target?: string };

export const listAudit = (token: string | null, f: AuditFilters = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "") p.set(k, String(v));
  const qs = p.toString();
  return api(`/api/admin/audit${qs ? `?${qs}` : ""}`, z.array(AuditEntrySchema), { token });
};

export const listAuditActions = (token: string | null) =>
  api("/api/admin/audit/actions", z.array(z.string()), { token });

/** An entity's activity feed (its audit trail) — gated server-side on reading that entity. */
export const getActivity = (token: string | null, targetType: string, targetId: string) =>
  api(`/api/activity/${targetType}/${targetId}`, z.array(AuditEntrySchema), { token });
