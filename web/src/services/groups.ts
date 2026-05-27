import { z } from "zod";
import { api } from "./http";

/** F04 (W1.5) — asset groups: structural peer groupings (mirrors api.Groups). */
export const GROUP_KINDS = ["order", "set", "rig", "other"] as const;

export const GroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  notes: z.string().nullable(),
  memberCount: z.number(),
});
export type AssetGroup = z.infer<typeof GroupSchema>;

export const GroupRefSchema = z.object({ id: z.string(), name: z.string(), kind: z.string() });
export type AssetGroupRef = z.infer<typeof GroupRefSchema>;
const OkSchema = z.object({ ok: z.boolean() });

export const listGroups = (token: string | null) => api("/api/asset-groups", z.array(GroupSchema), { token });

export const createGroup = (token: string | null, body: { name: string; kind: string; notes: string | null }) =>
  api("/api/asset-groups", GroupSchema, { method: "POST", token, body });

/** The groups a given asset belongs to. */
export const groupsForAsset = (token: string | null, assetId: string) =>
  api(`/api/assets/${assetId}/groups`, z.array(GroupRefSchema), { token });

export const addToGroup = (token: string | null, assetId: string, groupId: string) =>
  api(`/api/assets/${assetId}/groups`, OkSchema, { method: "POST", token, body: { groupId } });

export const removeFromGroup = (token: string | null, assetId: string, groupId: string) =>
  api(`/api/assets/${assetId}/groups/${groupId}`, OkSchema, { method: "DELETE", token });
