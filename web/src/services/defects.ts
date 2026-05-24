import { z } from "zod";
import { api } from "./http";

/** F03 — a property defect (mirrors api.Defects.DefectView). */
export const DefectSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  locationId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.string(),
  status: z.string(),
  reportedBy: z.string().nullable(),
});
export type Defect = z.infer<typeof DefectSchema>;

export function listDefects(propertyId: string, token: string | null): Promise<Defect[]> {
  return api(`/api/properties/${propertyId}/defects`, z.array(DefectSchema), { token });
}
