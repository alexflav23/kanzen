import { fmtMoney } from "./money";

export type ExpenseStatus = "pending" | "approved" | "rejected";
export type MockExpense = {
  id: string;
  payee: string;
  description: string;
  amountMinor: number;
  currency: string;
  property: string;
  category: string;
  date: string;
  requestedBy: string;
  status: ExpenseStatus;
};

export const EXPENSES: MockExpense[] = [
  { id: "e1", payee: "Hudson Sandler", description: "HVAC quarterly service", amountMinor: 184000, currency: "GBP", property: "Wardian", category: "Maintenance", date: "2026-05-20", requestedBy: "Lorna", status: "pending" },
  { id: "e2", payee: "SG Roofing", description: "Roof tile repair", amountMinor: 264000, currency: "SGD", property: "Singapore", category: "Maintenance", date: "2026-05-19", requestedBy: "Siti", status: "pending" },
  { id: "e3", payee: "Waitrose", description: "Household supplies", amountMinor: 8400, currency: "GBP", property: "Wardian", category: "Household", date: "2026-05-15", requestedBy: "Marcia", status: "approved" },
];

// Kept for back-compat; delegates to the shared formatter.
export const money = fmtMoney;
