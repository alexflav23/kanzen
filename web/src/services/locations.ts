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

export type CreateLocationReq = { propertyId: string; parentId: string | null; kind: string; name: string; floor: string | null; area: string | null; notes: string | null };

/** Add a room/area to a property (Manager+). */
export function createLocation(req: CreateLocationReq, token: string | null): Promise<Location> {
  return api("/api/locations", LocationSchema, { method: "POST", body: req, token });
}
