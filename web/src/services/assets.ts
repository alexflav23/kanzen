import { z } from "zod";
import { api } from "./http";

/** F04 — asset list card (mirrors api.Assets.AssetView). */
export const AssetViewSchema = z.object({
  id: z.string(),
  title: z.string(),
  maker: z.string().nullable(),
  categoryId: z.string().nullable(),
  trackingMode: z.string(),
  quantity: z.number(),
  ownershipStatus: z.string(),
  acquisitionCostMinor: z.number().nullable(),
  acquisitionCurrency: z.string().nullable(),
  propertyId: z.string().nullable().optional(), // list-card only (resolved via location); absent on the detail view
  heroUrl: z.string().nullable().optional(), // F04 — signed blob URL of the hero photo (grid-card thumbnail)
});
export type AssetView = z.infer<typeof AssetViewSchema>;

/** F04 — full asset (mirrors api.Assets.AssetDetail). */
export const AssetDetailSchema = AssetViewSchema.extend({
  vertical: z.string().nullable(),
  parentAssetId: z.string().nullable(),
  acquisitionCostMinor: z.number().nullable(),
  acquisitionCurrency: z.string().nullable(),
  acquisitionDate: z.string().nullable(),
  locationId: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  custodyStatus: z.string(),
  heroDocumentId: z.string().nullable(),
  // W1.4 — resolved current-location label
  locationName: z.string().nullable().optional(),
  propertyName: z.string().nullable().optional(),
  // F20 — Principal-only; absent/null for Manager (stripped server-side)
  marketValueMinor: z.number().nullable().optional(),
  insuredValueMinor: z.number().nullable().optional(),
  valuationCurrency: z.string().nullable().optional(),
});
export type AssetDetail = z.infer<typeof AssetDetailSchema>;

export type CreateAssetReq = {
  title: string;
  maker: string | null;
  categoryId: string;
  vertical: string | null;
  trackingMode: string;
  quantity: number;
  parentAssetId: string | null;
  acquisitionCostMinor: number | null;
  acquisitionCurrency: string | null;
  acquisitionDate: string | null;
  locationId: string | null;
  attributes: Record<string, unknown> | null;
};

export type AssetFilters = {
  category?: string | null;
  q?: string | null;
  vertical?: string | null;
  property?: string | null;
  collection?: string | null;
  status?: string | null;
  tag?: string | null;
};

export function listAssets(token: string | null, filters: AssetFilters = {}): Promise<AssetView[]> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const qs = params.toString();
  return api(`/api/assets${qs ? `?${qs}` : ""}`, z.array(AssetViewSchema), { token });
}

export function getAsset(id: string, token: string | null): Promise<AssetDetail> {
  return api(`/api/assets/${id}`, AssetDetailSchema, { token });
}

/** F19 — lifecycle timeline + lifetime cost. */
export const AssetEventSchema = z.object({
  id: z.string(),
  eventType: z.string(),
  occurredAt: z.string(),
  costMinor: z.number().nullable(),
  currency: z.string().nullable(),
  note: z.string().nullable(),
  party: z.string().nullable(),
});
export const AssetTimelineSchema = z.object({ events: z.array(AssetEventSchema), lifetimeCostMinor: z.number() });
export type AssetTimeline = z.infer<typeof AssetTimelineSchema>;

export function getAssetTimeline(id: string, token: string | null): Promise<AssetTimeline> {
  return api(`/api/assets/${id}/events`, AssetTimelineSchema, { token });
}

export type AssetEvent = z.infer<typeof AssetEventSchema>;
export type LogEventReq = {
  eventType: string;
  costMinor: number | null;
  currency: string | null;
  note: string | null;
  party?: string | null;
  occurredAt?: string | null; // ISO date — backdate to record retroactively (F19 AC5)
};

/** F19 — log a lifecycle event onto the asset's timeline (Manager+). */
export function logAssetEvent(id: string, token: string | null, req: LogEventReq): Promise<AssetEvent> {
  return api(`/api/assets/${id}/events`, AssetEventSchema, { method: "POST", token, body: req });
}

/** F20 — dated valuation snapshots (Principal-only). */
export const ValuationSchema = z.object({ id: z.string(), assetId: z.string(), kind: z.string(), amountMinor: z.number(), currency: z.string() });
export type Valuation = z.infer<typeof ValuationSchema>;
export type RecordValuationReq = { kind: string; amountMinor: number; currency: string; source: string | null };

export function getValuations(id: string, token: string | null): Promise<Valuation[]> {
  return api(`/api/assets/${id}/valuations`, z.array(ValuationSchema), { token });
}
export function recordValuation(id: string, token: string | null, req: RecordValuationReq): Promise<Valuation> {
  return api(`/api/assets/${id}/valuations`, ValuationSchema, { method: "POST", token, body: req });
}

/** F21 — warranties + insurance (insurance is Principal-only). */
export const WarrantySchema = z.object({
  id: z.string(),
  provider: z.string().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
});
export type Warranty = z.infer<typeof WarrantySchema>;

export const InsuranceSchema = z.object({
  insured: z.boolean(),
  policyRef: z.string().nullable(),
  insurer: z.string().nullable(),
  insuredValueMinor: z.number().nullable(),
  renewalOn: z.string().nullable(),
});
export type Insurance = z.infer<typeof InsuranceSchema>;

export function listWarranties(id: string, token: string | null): Promise<Warranty[]> {
  return api(`/api/assets/${id}/warranties`, z.array(WarrantySchema), { token });
}

export function getInsurance(id: string, token: string | null): Promise<Insurance> {
  return api(`/api/assets/${id}/insurance`, InsuranceSchema, { token });
}

export type EditAssetReq = { title: string; maker: string | null; categoryId: string; ownershipStatus: string };

/** Edit an asset's key facts (Manager+). */
export function editAsset(id: string, token: string | null, req: EditAssetReq): Promise<AssetDetail> {
  return api(`/api/assets/${id}`, AssetDetailSchema, { method: "PATCH", token, body: req });
}

export function createAsset(req: CreateAssetReq, token: string | null): Promise<AssetDetail> {
  return api("/api/assets", AssetDetailSchema, { method: "POST", body: req, token });
}

// ---- W1.4: move / custody / hero / history --------------------------------------------------

/** Move the asset to a location (Manager+; target must be in scope) — writes location history. */
export function moveAsset(id: string, token: string | null, body: { locationId: string | null; note: string | null }): Promise<AssetDetail> {
  return api(`/api/assets/${id}/location`, AssetDetailSchema, { method: "POST", token, body });
}

export const CUSTODY_STATUSES = ["with_owner", "with_manager", "on_loan", "in_storage", "with_repair_shop", "in_transit"] as const;

/** Change the asset's custody (Manager+) — writes custody history. */
export function changeCustody(id: string, token: string | null, body: { custodyStatus: string; note: string | null }): Promise<AssetDetail> {
  return api(`/api/assets/${id}/custody`, AssetDetailSchema, { method: "POST", token, body });
}

/** Set the asset's hero photo from a document (Manager+). */
export function setHeroPhoto(id: string, token: string | null, documentId: string): Promise<AssetDetail> {
  return api(`/api/assets/${id}/hero-photo`, AssetDetailSchema, { method: "POST", token, body: { documentId } });
}

export const LocationHistorySchema = z.object({
  id: z.string(),
  locationName: z.string().nullable(),
  propertyName: z.string().nullable(),
  movedBy: z.string().nullable(),
  movedAt: z.string(),
  note: z.string().nullable(),
});
export const CustodyHistorySchema = z.object({
  id: z.string(),
  custodyStatus: z.string(),
  changedBy: z.string().nullable(),
  changedAt: z.string(),
  note: z.string().nullable(),
});
export const AssetHistorySchema = z.object({
  location: z.array(LocationHistorySchema),
  custody: z.array(CustodyHistorySchema),
});
export type AssetHistory = z.infer<typeof AssetHistorySchema>;

/** Location + custody history (newest first). */
export function getAssetHistory(id: string, token: string | null): Promise<AssetHistory> {
  return api(`/api/assets/${id}/history`, AssetHistorySchema, { token });
}
