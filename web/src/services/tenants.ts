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
