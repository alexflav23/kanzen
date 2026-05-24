import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const h = vi.hoisted(() => {
  const e = (id: string, payee: string, amt: number) => ({ id, payee, amountMinor: amt, currency: "GBP", status: "pending_approval", deductible: false, vatReclaimable: false });
  return { pending: [e("e1", "Bonhams appraisal", 180000), e("e2", "Restoration deposit", 250000)] };
});

vi.mock("../services/finance", () => ({
  listBills: async () => [
    { id: "b1", payee: "Thames Water", amountMinor: 14500, currency: "GBP", varianceFlag: false },
    { id: "b2", payee: "British Gas", amountMinor: 22000, currency: "GBP", varianceFlag: true },
  ],
  listPayments: async () => [],
  markPaid: vi.fn(),
  listExpenses: async (_t: string | null, status?: string | null) => (status === "pending_approval" ? h.pending : []),
  approveExpense: async (id: string) => { h.pending = h.pending.filter((e) => e.id !== id); return { id, payee: "x", amountMinor: 0, currency: "GBP", status: "approved", deductible: false, vatReclaimable: false }; },
  rejectExpense: async (id: string) => { h.pending = h.pending.filter((e) => e.id !== id); return { id, payee: "x", amountMinor: 0, currency: "GBP", status: "rejected", deductible: false, vatReclaimable: false }; },
  getIncomeEstimate: async (_t: string | null, incomeMinor: number) => ({ grossMinor: incomeMinor, estimatedTaxMinor: 5212600, takeHomeMinor: incomeMinor - 5212600, effectiveRatePct: 35 }),
  getDeductibleReport: async () => ({ deductibleTotalMinor: 184000, vatReclaimableTotalMinor: 30667, deductibleCount: 1 }),
}));

vi.mock("../services/bank", () => ({
  listAccounts: async () => [{ id: "acc1", name: "Coutts current", currency: "GBP", kind: "current" }],
  listTransactions: async () => [
    { id: "t1", providerTxId: "p1", bookedOn: "2026-05-10", amountMinor: 4200, currency: "GBP", direction: "debit", description: "Waitrose", merchant: "Waitrose", reconciliationState: "unmatched" },
  ],
}));

import { Finance } from "../pages/Finance";

const renderFinance = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider><Finance /></AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  h.pending = [
    { id: "e1", payee: "Bonhams appraisal", amountMinor: 180000, currency: "GBP", status: "pending_approval", deductible: false, vatReclaimable: false },
    { id: "e2", payee: "Restoration deposit", amountMinor: 250000, currency: "GBP", status: "pending_approval", deductible: false, vatReclaimable: false },
  ];
  localStorage.setItem("kanzen.token", "t");
});

describe("Finance", () => {
  it("shows the recurring schedule by default", async () => {
    renderFinance();
    expect(await screen.findByText("Recurring schedule · 2")).toBeInTheDocument();
    expect(await screen.findAllByTestId("bill-row")).toHaveLength(2);
  });

  it("shows pending approvals under the Expenses tab", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
    expect(await screen.findAllByTestId("pending-row")).toHaveLength(2);
  });

  it("approving removes an item from the pending queue", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
    await screen.findAllByTestId("pending-row");
    fireEvent.click(screen.getAllByRole("button", { name: /Approve/ })[0]);
    await waitFor(() => expect(screen.getAllByTestId("pending-row")).toHaveLength(1));
  });

  it("the Transactions tab lists an account's transactions with reconciliation state (F12/F14)", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(await screen.findByTestId("txn-row")).toBeInTheDocument();
    expect(screen.getByText("Waitrose")).toBeInTheDocument();
    expect(screen.getByText("unmatched")).toBeInTheDocument();
  });

  it("the Tax tab shows the income estimate and deductible report (F38)", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Tax" }));
    expect(await screen.findByTestId("estimate")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument(); // effective rate
    expect(screen.getByTestId("deductible")).toBeInTheDocument();
    expect(screen.getByText("estimate only")).toBeInTheDocument(); // never files
  });
});
