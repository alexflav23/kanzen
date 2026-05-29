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

/** F43 — income statement (P&L) over a period. */
export const IncomeStatementSchema = z.object({
  entityId: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  incomeMinor: z.number(),
  expenseMinor: z.number(),
  netMinor: z.number(),
});
export type IncomeStatement = z.infer<typeof IncomeStatementSchema>;

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

// F42 — entity management (Principal-private). Base currency is set at creation and immutable thereafter.
export type CreateEntityReq = { name: string; kind: string; jurisdiction: string | null; baseCurrency: string | null; parentEntityId: string | null };
export type UpdateEntityReq = { name: string; kind: string; jurisdiction: string | null; parentEntityId: string | null };

export const createEntity = (req: CreateEntityReq, token: string | null) =>
  api("/api/wealth/entities", EntitySchema, { method: "POST", body: req, token });
export const updateEntity = (id: string, req: UpdateEntityReq, token: string | null) =>
  api(`/api/wealth/entities/${id}`, EntitySchema, { method: "PATCH", body: req, token });
export const getNetWorth = (token: string | null, entity?: string | null) =>
  api(`/api/wealth/net-worth${entityQs(entity)}`, NetWorthSchema, { token });
export const getBalanceSheet = (token: string | null, entity?: string | null) =>
  api(`/api/wealth/balance-sheet${entityQs(entity)}`, BalanceSheetSchema, { token });
export const listHoldings = (token: string | null, entity?: string | null) =>
  api(`/api/investments/holdings${entityQs(entity)}`, z.array(HoldingSchema), { token });

/** F40 — securities + record-a-trade (records investments; never executes trades). Principal-private. */
export const SecuritySchema = z.object({ id: z.string(), symbol: z.string(), name: z.string(), currency: z.string(), assetClass: z.string() });
export type Security = z.infer<typeof SecuritySchema>;
export const SellResultSchema = z.object({ quantitySold: z.number(), proceedsMinor: z.number(), costBasisMinor: z.number(), realizedGainMinor: z.number() });
export type SellResult = z.infer<typeof SellResultSchema>;

export const listSecurities = (token: string | null) => api("/api/investments/securities", z.array(SecuritySchema), { token });
export const createSecurity = (req: { symbol: string; name: string; currency: string | null; assetClass: string | null }, token: string | null) =>
  api("/api/investments/securities", SecuritySchema, { method: "POST", body: req, token });
export const recordBuy = (req: { entityId: string; securityId: string; quantity: number; costBasisMinor: number; acquiredOn: string | null }, token: string | null) =>
  api("/api/investments/lots", z.object({ id: z.string() }), { method: "POST", body: req, token });
export const recordSell = (req: { entityId: string; securityId: string; quantity: number; proceedsMinor: number; on: string | null }, token: string | null) =>
  api("/api/investments/sell", SellResultSchema, { method: "POST", body: req, token });
export const getIncomeStatement = (token: string | null, from: string, to: string, entity?: string | null) => {
  const qs = new URLSearchParams({ from, to });
  if (entity) qs.set("entity", entity);
  return api(`/api/wealth/income-statement?${qs.toString()}`, IncomeStatementSchema, { token });
};
