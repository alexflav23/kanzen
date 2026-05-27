import { z } from "zod";
import { api } from "./http";

/** F02 v2 — enterprise RBAC builder client. Permission sets + grants, role composition (parent + sets), nested
 *  teams (members/roles/property scopes), multi-role users, and the effective-permissions preview. Admin only,
 *  server-side; every write is audited. Mirrors `/api/admin/rbac/*` + `/api/admin/permission-catalogue`. */

const Ok = z.object({ ok: z.boolean() });

export const ActionSchema = z.object({
  resource: z.string(),
  verb: z.string(),
  minLevel: z.string(),
  sensitive: z.boolean(),
});
export type CatalogueAction = z.infer<typeof ActionSchema>;
export const getCatalogue = (token: string | null) =>
  api("/api/admin/permission-catalogue", z.array(ActionSchema), { token });

// ── permission sets ──────────────────────────────────────────────────────────
export const SetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  grantCount: z.number(),
});
export type PermissionSet = z.infer<typeof SetSchema>;
export const GrantSchema = z.object({
  resource: z.string(),
  action: z.string(),
  field: z.string(),
  scope: z.string(),
  effect: z.string(),
});
export type Grant = z.infer<typeof GrantSchema>;

const base = "/api/admin/rbac";
export const listSets = (token: string | null) => api(`${base}/sets`, z.array(SetSchema), { token });
export const createSet = (token: string | null, name: string, description: string | null) =>
  api(`${base}/sets`, SetSchema, { method: "POST", token, body: { name, description } });
export const updateSet = (token: string | null, id: string, name: string, description: string | null) =>
  api(`${base}/sets/${id}`, Ok, { method: "PUT", token, body: { name, description } });
export const deleteSet = (token: string | null, id: string) =>
  api(`${base}/sets/${id}`, Ok, { method: "DELETE", token });
export const getGrants = (token: string | null, id: string) =>
  api(`${base}/sets/${id}/grants`, z.array(GrantSchema), { token });
export const upsertGrant = (token: string | null, id: string, g: Grant) =>
  api(`${base}/sets/${id}/grants`, GrantSchema, { method: "PUT", token, body: g });
export const deleteGrant = (token: string | null, id: string, resource: string, action: string, field: string) =>
  api(`${base}/sets/${id}/grants?${new URLSearchParams({ resource, action, field }).toString()}`, Ok, {
    method: "DELETE",
    token,
  });

// ── role composition ──────────────────────────────────────────────────────────
export const CompositionSchema = z.object({
  role: z.string(),
  parentRole: z.string().nullable(),
  setIds: z.array(z.string()),
});
export type RoleComposition = z.infer<typeof CompositionSchema>;
export const getComposition = (token: string | null, role: string) =>
  api(`${base}/roles/${encodeURIComponent(role)}/composition`, CompositionSchema, { token });
export const setParent = (token: string | null, role: string, parent: string | null) =>
  api(`${base}/roles/${encodeURIComponent(role)}/parent`, Ok, { method: "PUT", token, body: { parent } });
export const attachSet = (token: string | null, role: string, setId: string) =>
  api(`${base}/roles/${encodeURIComponent(role)}/sets`, Ok, { method: "POST", token, body: { setId } });
export const detachSet = (token: string | null, role: string, setId: string) =>
  api(`${base}/roles/${encodeURIComponent(role)}/sets/${setId}`, Ok, { method: "DELETE", token });

// ── teams ──────────────────────────────────────────────────────────────────────
export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentTeamId: z.string().nullable(),
  description: z.string().nullable(),
  memberCount: z.number(),
  roleCount: z.number(),
});
export type Team = z.infer<typeof TeamSchema>;
export const TeamDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentTeamId: z.string().nullable(),
  description: z.string().nullable(),
  members: z.array(z.string()),
  roles: z.array(z.string()),
  propertyScopes: z.array(z.string()),
});
export type TeamDetail = z.infer<typeof TeamDetailSchema>;
export const listTeams = (token: string | null) => api(`${base}/teams`, z.array(TeamSchema), { token });
export const getTeam = (token: string | null, id: string) =>
  api(`${base}/teams/${id}`, TeamDetailSchema, { token });
export const createTeam = (token: string | null, name: string, parentTeamId: string | null, description: string | null) =>
  api(`${base}/teams`, TeamSchema, { method: "POST", token, body: { name, parentTeamId, description } });
export const updateTeam = (token: string | null, id: string, name: string, parentTeamId: string | null, description: string | null) =>
  api(`${base}/teams/${id}`, Ok, { method: "PUT", token, body: { name, parentTeamId, description } });
export const deleteTeam = (token: string | null, id: string) =>
  api(`${base}/teams/${id}`, Ok, { method: "DELETE", token });
export const addMember = (token: string | null, id: string, userId: string) =>
  api(`${base}/teams/${id}/members`, Ok, { method: "POST", token, body: { userId } });
export const removeMember = (token: string | null, id: string, userId: string) =>
  api(`${base}/teams/${id}/members/${userId}`, Ok, { method: "DELETE", token });
export const addTeamRole = (token: string | null, id: string, role: string) =>
  api(`${base}/teams/${id}/roles`, Ok, { method: "POST", token, body: { role } });
export const removeTeamRole = (token: string | null, id: string, role: string) =>
  api(`${base}/teams/${id}/roles/${encodeURIComponent(role)}`, Ok, { method: "DELETE", token });
export const addTeamScope = (token: string | null, id: string, propertyId: string) =>
  api(`${base}/teams/${id}/scopes`, Ok, { method: "POST", token, body: { propertyId } });
export const removeTeamScope = (token: string | null, id: string, propertyId: string) =>
  api(`${base}/teams/${id}/scopes/${propertyId}`, Ok, { method: "DELETE", token });

// ── users (assignment + preview) ─────────────────────────────────────────────────
export const UserSchema = z.object({ id: z.string(), displayName: z.string(), email: z.string(), role: z.string() });
export type RbacUser = z.infer<typeof UserSchema>;
export const listUsers = (token: string | null) => api(`${base}/users`, z.array(UserSchema), { token });
export const getUserRoles = (token: string | null, userId: string) =>
  api(`${base}/users/${userId}/roles`, z.array(z.string()), { token });
export const addUserRole = (token: string | null, userId: string, role: string) =>
  api(`${base}/users/${userId}/roles`, Ok, { method: "POST", token, body: { role } });
export const removeUserRole = (token: string | null, userId: string, role: string) =>
  api(`${base}/users/${userId}/roles/${encodeURIComponent(role)}`, Ok, { method: "DELETE", token });

export const EffActionSchema = z.object({
  key: z.string(),
  resource: z.string(),
  verb: z.string(),
  scope: z.string(),
  sensitive: z.boolean(),
});
export const EffectiveSchema = z.object({
  userId: z.string(),
  primaryRole: z.string().nullable(),
  effectiveRoles: z.array(z.string()),
  allowed: z.array(EffActionSchema),
});
export type Effective = z.infer<typeof EffectiveSchema>;
export const getEffective = (token: string | null, userId: string) =>
  api(`${base}/users/${userId}/effective`, EffectiveSchema, { token });
