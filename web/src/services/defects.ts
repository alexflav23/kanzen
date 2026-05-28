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
  assignedVendorId: z.string().nullable(),
  assignedVendorName: z.string().nullable(),
  hasTask: z.boolean(),
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

/** Edit a defect's particulars (Manager+). */
export function patchDefect(id: string, req: { title: string; description: string | null; severity: string }, token: string | null): Promise<Defect> {
  return api(`/api/defects/${id}`, DefectSchema, { method: "PATCH", body: req, token });
}

/** Assign (or clear, with null) the vendor responsible for a defect (Manager+; F09). */
export function assignDefectVendor(id: string, vendorId: string | null, token: string | null): Promise<Defect> {
  return api(`/api/defects/${id}/vendor`, DefectSchema, { method: "POST", body: { vendorId }, token });
}

/** Spawn a fix-task into the property's task project and link it to the defect (Manager+; F06). */
export function spawnDefectTask(id: string, token: string | null): Promise<Defect> {
  return api(`/api/defects/${id}/task`, DefectSchema, { method: "POST", token });
}
