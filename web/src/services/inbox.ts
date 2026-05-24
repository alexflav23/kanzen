import { z } from "zod";
import { api } from "./http";

/** F26 — unified inbox counts across review streams. */
export const InboxSchema = z.object({
  counts: z.record(z.string(), z.number()),
  total: z.number(),
});
export type Inbox = z.infer<typeof InboxSchema>;

/** F25/F26 — a proposed agent action in the Triage stream. */
export const AgentActionSchema = z.object({
  id: z.string(),
  actionType: z.string(),
  status: z.string(),
  category: z.string().nullable(),
  subject: z.string().nullable(),
  locked: z.boolean(),
});
export type AgentAction = z.infer<typeof AgentActionSchema>;
const OkSchema = z.object({ ok: z.boolean() });

/** F28 — a permission-filtered search hit. */
export const SearchHitSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
});
export const SearchResultsSchema = z.object({ query: z.string(), hits: z.array(SearchHitSchema) });
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const getInbox = (token: string | null) => api("/api/inbox", InboxSchema, { token });
export const listActions = (token: string | null, status = "proposed") =>
  api(`/api/agent/actions?status=${encodeURIComponent(status)}`, z.array(AgentActionSchema), { token });
export const confirmAction = (id: string, token: string | null) =>
  api(`/api/agent/actions/${id}/confirm`, OkSchema, { method: "POST", token });
export const rejectAction = (id: string, token: string | null) =>
  api(`/api/agent/actions/${id}/reject`, OkSchema, { method: "POST", token });
export const search = (token: string | null, q: string) =>
  api(`/api/search?q=${encodeURIComponent(q)}`, SearchResultsSchema, { token });
