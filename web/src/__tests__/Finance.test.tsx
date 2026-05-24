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
});
