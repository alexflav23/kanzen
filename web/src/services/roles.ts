import { z } from "zod";
import { api } from "./http";

/** F02 — admin role-management. Reads + edits the permission matrix the backend Authorizer enforces;
  * a change recalibrates every principal's UI on their next /api/me. Admin only, server-side. */

export const RoleSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
});
export type RoleDef = z.infer<typeof RoleSchema>;

export const RuleSchema = z.object({
  role: z.string(),
  resource: z.string(),
  field: z.string().nullable(),
  level: z.string(),
});
export type Rule = z.infer<typeof RuleSchema>;

export type RuleInput = { role: string; resource: string; field: string | null; level: string };

export const getRoles = (token: string | null) => api("/api/admin/roles", z.array(RoleSchema), { token });

/** Create a custom role (starts default-deny; tune its permissions in the matrix). */
export const createRole = (token: string | null, name: string, description: string | null) =>
  api("/api/admin/roles", RoleSchema, { method: "POST", token, body: { name, description } });

/** Delete a custom role + its rules (system + in-use roles are protected server-side). */
export const deleteRole = (token: string | null, name: string) =>
  api(`/api/admin/roles?${new URLSearchParams({ name }).toString()}`, z.object({ ok: z.boolean() }), { method: "DELETE", token });

export const getPermissions = (token: string | null) =>
  api("/api/admin/permissions", z.array(RuleSchema), { token });

export const setPermission = (token: string | null, rule: RuleInput) =>
  api("/api/admin/permissions", RuleSchema, { method: "PUT", token, body: rule });

const OkSchema = z.object({ ok: z.boolean() });
export const deletePermission = (token: string | null, role: string, resource: string, field: string | null) => {
  const q = new URLSearchParams({ role, resource });
  if (field != null) q.set("field", field);
  return api(`/api/admin/permissions?${q.toString()}`, OkSchema, { method: "DELETE", token });
};
