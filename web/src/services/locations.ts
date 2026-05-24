import { z } from "zod";
import { api } from "./http";

/** F03 — a node in a property's typed location tree (mirrors api.Locations.LocationView). */
export const LocationSchema = z.object({
  id: z.string(),
  parentId: z.string().nullable(),
  kind: z.string(),
  name: z.string(),
  floor: z.string().nullable(),
  area: z.string().nullable(),
  notes: z.string().nullable(),
});
export type Location = z.infer<typeof LocationSchema>;

export function listLocations(propertyId: string, token: string | null): Promise<Location[]> {
  return api(`/api/properties/${propertyId}/locations`, z.array(LocationSchema), { token });
}
