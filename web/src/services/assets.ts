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
});
export type AssetView = z.infer<typeof AssetViewSchema>;

/** F04 — full asset (mirrors api.Assets.AssetDetail). */
export const AssetDetailSchema = AssetViewSchema.extend({
  vertical: z.string().nullable(),
  parentAssetId: z.string().nullable(),
  acquisitionCostMinor: z.number().nullable(),
  acquisitionCurrency: z.string().nullable(),
  locationId: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
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
  locationId: string | null;
  attributes: Record<string, unknown> | null;
};

export function listAssets(token: string | null, category?: string | null, q?: string | null): Promise<AssetView[]> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
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

export function createAsset(req: CreateAssetReq, token: string | null): Promise<AssetDetail> {
  return api("/api/assets", AssetDetailSchema, { method: "POST", body: req, token });
}
