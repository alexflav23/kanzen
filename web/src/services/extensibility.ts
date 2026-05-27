import { z } from "zod";
import { api } from "./http";

/** F33 — Principal-define extensibility: user-defined taxonomies (trees) + typed custom-field definitions.
 *  (Tags live in services/tags.ts.) Mirrors api.Extensibility; Principal-define / Manager-use server-side. */

export const ENTITY_TYPES = ["asset", "vendor", "product", "person", "property", "document", "list_item"] as const;
export const FIELD_TYPES = ["text", "number", "money", "date", "bool", "enum", "url"] as const;
const Ok = z.object({ ok: z.boolean() });

// ── taxonomies (trees) ──────────────────────────────────────────────────────
export const TaxonomySchema = z.object({ id: z.string(), name: z.string(), appliesTo: z.string(), isSystem: z.boolean() });
export type Taxonomy = z.infer<typeof TaxonomySchema>;
export const NodeSchema = z.object({ id: z.string(), parentId: z.string().nullable(), name: z.string() });
export type TaxonomyNode = z.infer<typeof NodeSchema>;

export const listTaxonomies = (token: string | null) => api("/api/taxonomies", z.array(TaxonomySchema), { token });
export const createTaxonomy = (token: string | null, name: string, appliesTo: string) =>
  api("/api/taxonomies", TaxonomySchema, { method: "POST", token, body: { name, appliesTo } });
export const listNodes = (token: string | null, taxonomyId: string) =>
  api(`/api/taxonomies/${taxonomyId}/nodes`, z.array(NodeSchema), { token });
export const addNode = (token: string | null, taxonomyId: string, parentId: string | null, name: string) =>
  api(`/api/taxonomies/${taxonomyId}/nodes`, NodeSchema, { method: "POST", token, body: { parentId, name } });

// ── custom-field definitions ─────────────────────────────────────────────────
export const CustomFieldSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  key: z.string(),
  label: z.string(),
  type: z.string(),
  enumValues: z.array(z.string()).nullable(),
  sensitive: z.boolean(),
});
export type CustomField = z.infer<typeof CustomFieldSchema>;

export const listCustomFields = (token: string | null, entityType: string) =>
  api(`/api/custom-fields?${new URLSearchParams({ entityType }).toString()}`, z.array(CustomFieldSchema), { token });
export const createCustomField = (
  token: string | null,
  body: { entityType: string; key: string; label: string; type: string; enumValues: string[] | null; sensitive: boolean },
) => api("/api/custom-fields", CustomFieldSchema, { method: "POST", token, body });
export const deleteCustomField = (token: string | null, id: string) =>
  api(`/api/custom-fields/${id}`, Ok, { method: "DELETE", token });
