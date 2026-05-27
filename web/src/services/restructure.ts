import { z } from "zod";
import { api } from "./http";

/** F24 — asset restructure: merge two assets (lineage + cost preserved), split one into children (cost
 *  allocated), and reverse any op. Manager+ (asset:restructure), audited; corrections are events. */

export const MergeResultSchema = z.object({
  opId: z.string(),
  survivorId: z.string(),
  mergedId: z.string(),
  combinedCostMinor: z.number(),
});
export type MergeResult = z.infer<typeof MergeResultSchema>;

export const SplitResultSchema = z.object({
  opId: z.string(),
  parentId: z.string(),
  childIds: z.array(z.string()),
  allocatedMinor: z.array(z.number()),
});
export type SplitResult = z.infer<typeof SplitResultSchema>;

export const ReverseResultSchema = z.object({ opId: z.string(), reverseOpId: z.string(), kind: z.string() });

export const mergeAssets = (token: string | null, survivorId: string, mergedId: string) =>
  api("/api/assets/merge", MergeResultSchema, { method: "POST", token, body: { survivorId, mergedId } });

export const splitAsset = (token: string | null, assetId: string, intoCount: number) =>
  api("/api/assets/split", SplitResultSchema, { method: "POST", token, body: { assetId, intoCount } });

export const reverseRestructure = (token: string | null, opId: string) =>
  api(`/api/restructure/${opId}/reverse`, ReverseResultSchema, { method: "POST", token });
