import { z } from "zod";
import { api } from "./http";

/** F15 — recurring bills. */
export const BillSchema = z.object({
  id: z.string(),
  payee: z.string(),
  amountMinor: z.number(),
  currency: z.string(),
  varianceFlag: z.boolean(),
  propertyId: z.string().nullable(),
  category: z.string().nullable(),
});
export type Bill = z.infer<typeof BillSchema>;
export type CreateBillReq = { payee: string; propertyId: string | null; category: string | null; amountMinor: number; currency: string; frequency: string | null };

/** F16 — pay-queue items. */
export const PaymentSchema = z.object({
  id: z.string(),
  amountMinor: z.number(),
  currency: z.string(),
  mode: z.string(),
  state: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;
const PaymentViewSchema = z.object({ id: z.string(), mode: z.string(), state: z.string() });

/** F17 — expenses. */
export const ExpenseSchema = z.object({
  id: z.string(),
  payee: z.string().nullable(),
  amountMinor: z.number(),
  currency: z.string(),
  status: z.string(),
  deductible: z.boolean(),
  vatReclaimable: z.boolean(),
});
export type Expense = z.infer<typeof ExpenseSchema>;

export const listBills = (token: string | null) => api("/api/bills", z.array(BillSchema), { token });
export const createBill = (req: CreateBillReq, token: string | null) => api("/api/bills", BillSchema, { method: "POST", body: req, token });
export const listPayments = (token: string | null) => api("/api/payments", z.array(PaymentSchema), { token });
export const markPaid = (id: string, token: string | null) => api(`/api/payments/${id}/mark-paid`, PaymentViewSchema, { method: "POST", token });

export const listExpenses = (token: string | null, status?: string | null) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return api(`/api/expenses${qs}`, z.array(ExpenseSchema), { token });
};
export const approveExpense = (id: string, token: string | null) => api(`/api/expenses/${id}/approve`, ExpenseSchema, { method: "POST", token });
export const rejectExpense = (id: string, token: string | null) => api(`/api/expenses/${id}/reject`, ExpenseSchema, { method: "POST", token });

/** F38 — UK income-tax estimate (estimate only; Kanzen never files). */
export const IncomeEstimateSchema = z.object({
  grossMinor: z.number(),
  estimatedTaxMinor: z.number(),
  takeHomeMinor: z.number(),
  effectiveRatePct: z.number(),
});
export type IncomeEstimate = z.infer<typeof IncomeEstimateSchema>;

/** F38 — deductible + VAT-reclaimable totals across approved expenses. */
export const DeductibleReportSchema = z.object({
  deductibleTotalMinor: z.number(),
  vatReclaimableTotalMinor: z.number(),
  deductibleCount: z.number(),
});
export type DeductibleReport = z.infer<typeof DeductibleReportSchema>;

export const getIncomeEstimate = (token: string | null, incomeMinor: number) =>
  api(`/api/tax/income-estimate?income=${incomeMinor}`, IncomeEstimateSchema, { token });
export const getDeductibleReport = (token: string | null) =>
  api("/api/tax/deductible-report", DeductibleReportSchema, { token });
