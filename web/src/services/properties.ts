import { z } from "zod";
import { api } from "./http";

/** F03 — the property as the API returns it (mirrors backend api.Properties.PropertyView), incl. the
  * per-property rooms/assets/bills/vendors tallies shown on the cards + Bible. */
export const PropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  jurisdiction: z.string().nullable(),
  currency: z.string(),
  status: z.string(),
  rooms: z.number(),
  assets: z.number(),
  bills: z.number(),
  vendors: z.number(),
});
export type Property = z.infer<typeof PropertySchema>;

const PropertiesSchema = z.array(PropertySchema);

/** The Bible aggregate — same shape as the list row (the counts are the aggregate). */
export const PropertyDetailSchema = PropertySchema;
export type PropertyDetail = z.infer<typeof PropertyDetailSchema>;

export type CreatePropertyReq = {
  name: string;
  address: string | null;
  jurisdiction: string | null;
  propType: string | null;
  ownership: string | null;
  currency: string;
};

/** Properties visible to the signed-in principal (server-side authz-filtered). */
export function listProperties(token: string | null): Promise<Property[]> {
  return api("/api/properties", PropertiesSchema, { token });
}

/** A single property's Bible aggregate (404 if out of scope, 403 if no read). */
export function getProperty(id: string, token: string | null): Promise<PropertyDetail> {
  return api(`/api/properties/${id}`, PropertyDetailSchema, { token });
}

/** Create a property (Manager+). */
export function createProperty(req: CreatePropertyReq, token: string | null): Promise<Property> {
  return api("/api/properties", PropertySchema, { method: "POST", body: req, token });
}
