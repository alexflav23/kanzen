// Finance seed data — mirrors input/views/finance.jsx (bills + pay queue).
// Budgets are reused from mockDashboard. Real screens wire to F12–F18 later.

export type Bill = {
  id: string;
  payee: string;
  category: string;
  property: "wardian" | "singapore";
  freq: "Monthly" | "Quarterly" | "Annual";
  nextDue: string;
  amountMinor: number;
  currency: string;
  method: string;
  variancePct?: number;
};

export const BILLS: Bill[] = [
  { id: "b1", payee: "SP Group", category: "Utilities", property: "singapore", freq: "Monthly", nextDue: "2026-05-28", amountMinor: 61300, currency: "SGD", method: "GIRO", variancePct: 60 },
  { id: "b2", payee: "Thames Water", category: "Utilities", property: "wardian", freq: "Quarterly", nextDue: "2026-06-10", amountMinor: 14200, currency: "GBP", method: "Direct Debit" },
  { id: "b3", payee: "Sky Broadband", category: "Internet", property: "wardian", freq: "Monthly", nextDue: "2026-05-30", amountMinor: 5900, currency: "GBP", method: "Direct Debit" },
  { id: "b4", payee: "Marcia — cleaning", category: "Household", property: "wardian", freq: "Monthly", nextDue: "2026-05-31", amountMinor: 96000, currency: "GBP", method: "Bank transfer" },
  { id: "b5", payee: "Condo MCST", category: "Property", property: "singapore", freq: "Monthly", nextDue: "2026-06-01", amountMinor: 42000, currency: "SGD", method: "GIRO" },
  { id: "b6", payee: "Home insurance", category: "Insurance", property: "wardian", freq: "Annual", nextDue: "2026-06-30", amountMinor: 124000, currency: "GBP", method: "Card" },
];

export type PayItem = {
  id: string;
  payee: string;
  due: string;
  days: number;
  amountMinor: number;
  currency: string;
  method: string;
  property: string;
  category: string;
  auto: boolean;
  varianceFlag?: boolean;
  status?: "Scheduled" | "Awaiting review" | "Manual";
};

export const PAY_QUEUE: PayItem[] = [
  { id: "p1", payee: "SP Group", due: "2026-05-28", days: 6, amountMinor: 61300, currency: "SGD", method: "GIRO", property: "Singapore", category: "Utilities", auto: false, varianceFlag: true, status: "Awaiting review" },
  { id: "p2", payee: "Sky Broadband", due: "2026-05-30", days: 8, amountMinor: 5900, currency: "GBP", method: "Direct Debit", property: "Wardian", category: "Internet", auto: true, status: "Scheduled" },
  { id: "p3", payee: "Marcia — cleaning", due: "2026-05-31", days: 9, amountMinor: 96000, currency: "GBP", method: "Bank transfer", property: "Wardian", category: "Household", auto: false, status: "Manual" },
  { id: "p4", payee: "Condo MCST", due: "2026-06-01", days: 10, amountMinor: 42000, currency: "SGD", method: "GIRO", property: "Singapore", category: "Property", auto: true, status: "Scheduled" },
  { id: "p5", payee: "Thames Water", due: "2026-06-10", days: 19, amountMinor: 14200, currency: "GBP", method: "Direct Debit", property: "Wardian", category: "Utilities", auto: true, status: "Scheduled" },
];

export function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - new Date("2026-05-22T08:00:00Z").getTime()) / 86400000);
}
export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
