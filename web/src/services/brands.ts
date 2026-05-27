import { z } from "zod";
import { api } from "./http";

/** A brand in the global catalogue (mirrors api.Brands.BrandView). */
export const BrandSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.string(), // verified | community
});
export type Brand = z.infer<typeof BrandSchema>;

/** Ranked autocomplete suggestions for a category (hot cache → global usage → verified → alpha). */
export function searchBrands(category: string, q: string, token: string | null, limit = 8): Promise<Brand[]> {
  const params = new URLSearchParams({ category, limit: String(limit) });
  if (q.trim()) params.set("q", q.trim());
  return api(`/api/brands?${params.toString()}`, z.array(BrandSchema), { token });
}

/** Add a brand to the global catalogue + record a use (find-or-create; grows the catalogue + hot cache). */
export function recordBrand(name: string, category: string, token: string | null): Promise<Brand> {
  return api("/api/brands", BrandSchema, { method: "POST", body: { name, category }, token });
}
