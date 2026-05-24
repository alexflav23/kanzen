import { z } from "zod";
import { api } from "./http";

/** F29 — dashboard summary (mirrors api.Dashboard.Summary). */
export const SummarySchema = z.object({
  pendingApprovals: z.number(),
  properties: z.number(),
  assets: z.number(),
  expiringPermits: z.number(),
});
export type Summary = z.infer<typeof SummarySchema>;

export function getSummary(token: string | null): Promise<Summary> {
  return api("/api/dashboard", SummarySchema, { token });
}
