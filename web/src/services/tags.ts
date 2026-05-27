import { z } from "zod";
import { api } from "./http";

/** F33 — polymorphic tags (mirrors api.Extensibility.TagView). */
export const TagSchema = z.object({ id: z.string(), name: z.string() });
export type Tag = z.infer<typeof TagSchema>;
const OkSchema = z.object({ ok: z.boolean() });

export const listTags = (token: string | null) => api("/api/tags", z.array(TagSchema), { token });

export const createTag = (name: string, token: string | null) =>
  api("/api/tags", TagSchema, { method: "POST", body: { name }, token });

/** Tags attached to a given entity (asset/property/…). */
export const tagsFor = (entityType: string, entityId: string, token: string | null) =>
  api(`/api/tag-links/${entityType}/${entityId}`, z.array(TagSchema), { token });

export const tagEntity = (tagId: string, entityType: string, entityId: string, token: string | null) =>
  api("/api/tag-links", OkSchema, { method: "POST", body: { tagId, entityType, entityId }, token });

export const untagEntity = (tagId: string, entityType: string, entityId: string, token: string | null) =>
  api(`/api/tag-links/${tagId}/${entityType}/${entityId}`, OkSchema, { method: "DELETE", token });
