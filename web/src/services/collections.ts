import { z } from "zod";
import { api } from "./http";

/** F04 — an asset collection (named grouping) + its member assets. Registry-private. */
export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const MemberSchema = z.object({ assetId: z.string(), title: z.string() });
export type CollectionMember = z.infer<typeof MemberSchema>;

export const listCollections = (token: string | null) =>
  api("/api/collections", z.array(CollectionSchema), { token });

export const getMembers = (token: string | null, id: string) =>
  api(`/api/collections/${id}/members`, z.array(MemberSchema), { token });

export const createCollection = (token: string | null, name: string, description: string | null) =>
  api("/api/collections", CollectionSchema, { method: "POST", token, body: { name, description } });

/** Add an asset to a collection. */
export const addMember = (token: string | null, collectionId: string, assetId: string) =>
  api(`/api/collections/${collectionId}/members`, z.object({ ok: z.boolean() }), { method: "POST", token, body: { assetId } });
