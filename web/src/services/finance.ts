import { z } from "zod";
import { api } from "./http";

/** F15 — recurring bills. */
export const BillSchema = z.object({
  id: z.string(),
  payee: z.string(),
  amountMinor: z.number(),
  currency: z.string(),
  varianceFlag: z.boolean(),
});
export type Bill = z.infer<typeof BillSchema>;

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
export const listPayments = (token: string | null) => api("/api/payments", z.array(PaymentSchema), { token });
export const markPaid = (id: string, token: string | null) => api(`/api/payments/${id}/mark-paid`, PaymentViewSchema, { method: "POST", token });

export const listExpenses = (token: string | null, status?: string | null) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return api(`/api/expenses${qs}`, z.array(ExpenseSchema), { token });
};
export const approveExpense = (id: string, token: string | null) => api(`/api/expenses/${id}/approve`, ExpenseSchema, { method: "POST", token });
export const rejectExpense = (id: string, token: string | null) => api(`/api/expenses/${id}/reject`, ExpenseSchema, { method: "POST", token });
