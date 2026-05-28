import { z } from "zod";
import { api } from "./http";

/** F09 — a vendor (mirrors api.Vendors.VendorView). */
export const VendorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  trade: z.string().nullable(),
  ndaUntil: z.string().nullable(),
  insuranceUntil: z.string().nullable(),
  rating: z.number().nullable(),
});
export type Vendor = z.infer<typeof VendorSchema>;

const VendorViewSchema = VendorSchema; // create returns the same shape

export type CreateVendorReq = {
  name: string;
  type: string;
  trade: string | null;
  ndaUntil: string | null;
  insuranceUntil: string | null;
  rating: number | null;
};

export function listVendors(token: string | null): Promise<Vendor[]> {
  return api("/api/vendors", z.array(VendorSchema), { token });
}

/** Vendors assignable to a property — approved for it + insurance current (F09). */
export function selectableVendors(propertyId: string, token: string | null): Promise<Vendor[]> {
  return api(`/api/vendors/selectable?property=${propertyId}`, z.array(VendorSchema), { token });
}

export function createVendor(req: CreateVendorReq, token: string | null): Promise<Vendor> {
  return api("/api/vendors", VendorViewSchema, { method: "POST", body: req, token });
}
