import { z } from "zod";
import { api } from "./http";

/** F46 — public tenant signup (POST /api/tenants). Creates the workspace + its principal and seeds onboarding. */
export const CreateTenantResp = z.object({
  tenantId: z.string(),
  slug: z.string(),
  principalUserId: z.string(),
  currentStep: z.string(),
  note: z.string(),
});
export type CreateTenantResp = z.infer<typeof CreateTenantResp>;

export type CreateTenantReq = {
  name: string;
  slug: string;
  principal: { name: string; email: string };
};

export function createTenant(req: CreateTenantReq): Promise<CreateTenantResp> {
  return api("/api/tenants", CreateTenantResp, { method: "POST", body: req });
}

/** F46 §4 — the caller's tenant onboarding state (drives the Dashboard "finish setup" banner). */
export const SetupState = z.object({ currentStep: z.string().nullable(), completed: z.boolean() });
export type SetupState = z.infer<typeof SetupState>;

export const getSetupState = (token: string | null) =>
  api("/api/tenant/setup", SetupState, { token });

/** Human label for each onboarding step (matches F46 §3). */
export const STEP_LABEL: Record<string, string> = {
  verify_email: "Verify your email",
  workspace: "Connect Google Workspace",
  first_property: "Add your first property",
  initial_people: "Invite your team",
  mailboxes: "Set up operational mailboxes",
  optional_integrations: "Connect bank & market data",
  tour: "Take the guided tour",
};

/** A workspace name → a clean subdomain slug (lowercase, hyphenated, trimmed to the allowed shape). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
