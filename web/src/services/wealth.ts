import { z } from "zod";
import { api } from "./http";

/** Wave G (F42) — legal/family entities (books). */
export const EntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  jurisdiction: z.string().nullable(),
  baseCurrency: z.string(),
  parentEntityId: z.string().nullable(),
});
export type Entity = z.infer<typeof EntitySchema>;

/** F41 — consolidated net worth (computed; assets + investments − liabilities). */
export const NetWorthSchema = z.object({
  entityId: z.string().nullable(),
  cashAndOtherMinor: z.number(),
  investmentsMinor: z.number(),
  assetsMinor: z.number(),
  liabilitiesMinor: z.number(),
  netMinor: z.number(),
});
export type NetWorth = z.infer<typeof NetWorthSchema>;

/** F43 — balance sheet (assets = liabilities + equity). */
export const BalanceSheetSchema = z.object({
  entityId: z.string().nullable(),
  assetsMinor: z.number(),
  liabilitiesMinor: z.number(),
  equityMinor: z.number(),
  balances: z.boolean(),
});
export type BalanceSheet = z.infer<typeof BalanceSheetSchema>;

/** F40 — investment holdings at market with unrealised gain. */
export const HoldingSchema = z.object({
  securityId: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  costBasisMinor: z.number(),
  marketValueMinor: z.number(),
  unrealizedGainMinor: z.number(),
});
export type Holding = z.infer<typeof HoldingSchema>;

const entityQs = (entity?: string | null) => (entity ? `?entity=${encodeURIComponent(entity)}` : "");

export const listEntities = (token: string | null) => api("/api/wealth/entities", z.array(EntitySchema), { token });
export const getNetWorth = (token: string | null, entity?: string | null) =>
  api(`/api/wealth/net-worth${entityQs(entity)}`, NetWorthSchema, { token });
export const getBalanceSheet = (token: string | null, entity?: string | null) =>
  api(`/api/wealth/balance-sheet${entityQs(entity)}`, BalanceSheetSchema, { token });
export const listHoldings = (token: string | null, entity?: string | null) =>
  api(`/api/investments/holdings${entityQs(entity)}`, z.array(HoldingSchema), { token });
