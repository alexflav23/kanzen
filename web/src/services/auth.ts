import { z } from "zod";
import { api } from "./http";

export type Role = "principal" | "manager" | "staff";
export type Persona = { name: string; email: string; role: Role };

/** The real household personas (mirror the V2_21 seed). Used by the dev sign-in until
  * the Cognito hosted UI lands; the role flows into the backend's default-deny Authorizer. */
export const PERSONAS: Persona[] = [
  { name: "Flavian", email: "flavian@kanzen.local", role: "principal" },
  { name: "Lorna", email: "lorna@kanzen.local", role: "manager" },
  { name: "Marcia", email: "marcia@kanzen.local", role: "staff" },
  { name: "Siti", email: "siti@kanzen.local", role: "staff" },
];

const TokenSchema = z.object({ token: z.string(), note: z.string() });

/** DEV sign-in: ask the backend to mint a local JWT for a persona. Replaced by the
  * Cognito hosted-UI redirect once a pool exists. */
export function devToken(email: string, role: string): Promise<string> {
  return api("/api/dev/token", TokenSchema, { method: "POST", body: { email, role } }).then((r) => r.token);
}

/** F02 — one permission rule (resource/field → level), as the backend Authorizer holds it. */
export const PermSchema = z.object({ resource: z.string(), field: z.string().nullable(), level: z.string() });
export type Perm = z.infer<typeof PermSchema>;

/** F01/F02 — the authenticated principal + its effective permission set + impersonation state. */
export const MeSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  // F47 — identity colour (palette key or hex). May be empty for legacy users until backfill runs.
  colour: z.string().default(""),
  permissions: z.array(PermSchema),
  impersonatedBy: z.string().nullable(),
});
export type Me = z.infer<typeof MeSchema>;

export const getMe = (token: string | null) => api("/api/me", MeSchema, { token });

/** F02 — start impersonating a user (admin only); returns an act-as token. */
const ImpersonateSchema = z.object({ token: z.string(), email: z.string(), role: z.string() });
export const impersonate = (token: string | null, email: string): Promise<string> =>
  api("/api/impersonate", ImpersonateSchema, { method: "POST", token, body: { email } }).then((r) => r.token);

const RANK: Record<string, number> = { none: 0, read: 1, write: 2, admin: 3 };

/** Mirror the backend Authorizer: most-specific wins (resource rule > `*` wildcard); default-deny.
  * Resource-level only (field-level filtering stays server-side). Drives UI recalibration. */
export function can(perms: Perm[], resource: string, level: "read" | "write" | "admin" = "read"): boolean {
  const req = RANK[level];
  const rule = perms.find((p) => p.resource === resource && !p.field) ?? perms.find((p) => p.resource === "*" && !p.field);
  return rule ? (RANK[rule.level] ?? 0) >= req : false;
}
