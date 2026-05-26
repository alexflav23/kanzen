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

export type RaiseDefectReq = { propertyId: string; locationId: string | null; title: string; description: string | null; severity: string };

/** Raise a defect (Staff+ on their property). */
export function raiseDefect(req: RaiseDefectReq, token: string | null): Promise<Defect> {
  return api("/api/defects", DefectSchema, { method: "POST", body: req, token });
}

/** Move a defect along its lifecycle: open → in_progress → resolved / wont_fix (Manager+). */
export function setDefectStatus(id: string, status: string, token: string | null): Promise<Defect> {
  return api(`/api/defects/${id}/status`, DefectSchema, { method: "POST", body: { status }, token });
}
