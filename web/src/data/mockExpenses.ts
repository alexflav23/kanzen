export type ExpenseStatus = "pending" | "approved" | "rejected";
export type MockExpense = {
  id: string;
  payee: string;
  description: string;
  amountMinor: number;
  currency: string;
  property: string;
  status: ExpenseStatus;
};

export const EXPENSES: MockExpense[] = [
  { id: "e1", payee: "Hudson Sandler", description: "HVAC quarterly service", amountMinor: 184000, currency: "GBP", property: "Wardian", status: "pending" },
  { id: "e2", payee: "SG Roofing", description: "Roof tile repair", amountMinor: 264000, currency: "SGD", property: "Singapore", status: "pending" },
  { id: "e3", payee: "Waitrose", description: "Household supplies", amountMinor: 8400, currency: "GBP", property: "Wardian", status: "approved" },
];

export function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}
