import { z } from "zod";
import { api } from "./http";

/** F03 — the property as the API returns it (mirrors backend api.Properties.PropertyView). */
export const PropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  currency: z.string(),
  status: z.string(),
});
export type Property = z.infer<typeof PropertySchema>;

const PropertiesSchema = z.array(PropertySchema);

/** Properties visible to the signed-in principal (server-side authz-filtered). */
export function listProperties(token: string | null): Promise<Property[]> {
  return api("/api/properties", PropertiesSchema, { token });
}
