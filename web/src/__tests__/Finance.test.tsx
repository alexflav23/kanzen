import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../state/AuthContext";

const h = vi.hoisted(() => {
  const e = (id: string, payee: string, amt: number) => ({ id, payee, amountMinor: amt, currency: "GBP", status: "pending_approval", deductible: false, vatReclaimable: false });
  return { pending: [e("e1", "Bonhams appraisal", 180000), e("e2", "Restoration deposit", 250000)] };
});

vi.mock("../services/finance", () => ({
  listBills: async () => [
    { id: "b1", payee: "Thames Water", amountMinor: 14500, currency: "GBP", varianceFlag: false, propertyId: "p1", category: "utilities" },
    { id: "b2", payee: "British Gas", amountMinor: 22000, currency: "GBP", varianceFlag: true, propertyId: "p1", category: "utilities" },
  ],
  createBill: vi.fn(async (req: { payee: string; amountMinor: number; currency: string; propertyId: string | null; category: string | null }) => ({ id: "bNew", payee: req.payee, amountMinor: req.amountMinor, currency: req.currency, varianceFlag: false, propertyId: req.propertyId, category: req.category })),
  listPayments: async () => [],
  markPaid: vi.fn(),
  listMethods: async () => [{ id: "m1", displayName: "Coutts current", last4: "1234" }],
  createMethod: vi.fn(async (req: { displayName: string; last4: string | null }) => ({ id: "mNew", displayName: req.displayName, last4: req.last4 })),
  schedulePayment: vi.fn(async (req: { mode: string }) => ({ id: "pNew", mode: req.mode, state: "scheduled" })),
  EXPENSE_THRESHOLDS: { GBP: 150000, SGD: 250000 },
  submitExpense: vi.fn(async (req: { payee: string | null; amountMinor: number; currency: string; deductible: boolean; vatReclaimable: boolean }) => ({ id: "exNew", payee: req.payee, amountMinor: req.amountMinor, currency: req.currency, status: req.amountMinor >= 150000 ? "pending_approval" : "approved", deductible: req.deductible, vatReclaimable: req.vatReclaimable })),
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
  getSuggestions: async () => [
    {
      txn: { id: "t1", bookedOn: "2026-05-10", amountMinor: 184000, currency: "GBP", description: "Hudson Sandler Ltd", merchant: "Hudson Sandler" },
      candidates: [{ receiptId: "r1", merchant: "Hudson Sandler", totalMinor: 184000, currency: "GBP", score: 100, reasons: ["amount matches exactly", "merchant matches", "same currency"] }],
    },
    {
      txn: { id: "t2", bookedOn: "2026-05-12", amountMinor: 9999, currency: "GBP", description: "Unknown", merchant: null },
      candidates: [],
    },
  ],
  matchTxn: vi.fn(async () => ({ matchId: "m1", state: "matched" })),
}));

vi.mock("../services/properties", () => ({
  listProperties: async () => [{ id: "p1", name: "Wardian — Apt 5206", jurisdiction: "GB", currency: "GBP", status: "active", rooms: 0, assets: 0, bills: 0, vendors: 0 }],
}));

vi.mock("../services/receipts", () => ({
  listReceipts: async () => [{ id: "rc1", kind: "receipt", merchant: "Waitrose", totalMinor: 5470, currency: "GBP", status: "parsed" }],
  getReceipt: async () => ({
    receipt: { id: "rc1", kind: "receipt", merchant: "Waitrose", totalMinor: 5470, currency: "GBP", status: "parsed" },
    lines: [
      { id: "l1", lineNo: 1, description: "Nespresso pods Arpeggio", totalMinor: 3200, currency: "GBP", brandNorm: "nespresso", suggestedCategory: "Groceries", confirmedCategory: null, status: "parsed" },
      { id: "l2", lineNo: 2, description: "Frantoia olive oil 1L", totalMinor: 1280, currency: "GBP", brandNorm: "frantoia", suggestedCategory: "Groceries", confirmedCategory: null, status: "parsed" },
    ],
  }),
}));

import { Finance } from "../pages/Finance";
import { createBill, submitExpense, createMethod, schedulePayment } from "../services/finance";

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
  it("adds a recurring bill via the modal (payee · category · amount → minor units)", async () => {
    renderFinance();
    await screen.findAllByTestId("bill-row");
    fireEvent.click(screen.getByRole("button", { name: "Add bill" })); // header button
    const modal = await screen.findByTestId("add-bill");
    fireEvent.change(within(modal).getByLabelText("Payee"), { target: { value: "Hyperoptic" } });
    fireEvent.change(within(modal).getByLabelText("Amount"), { target: { value: "35.00" } });
    fireEvent.click(within(modal).getByRole("button", { name: "Add bill" })); // submit
    await waitFor(() =>
      expect(createBill).toHaveBeenCalledWith(
        expect.objectContaining({ payee: "Hyperoptic", amountMinor: 3500, currency: "GBP", category: "utilities" }),
        "t",
      ),
    );
  });

  it("submits a manual expense; an over-threshold amount is flagged as routing to the Principal", async () => {
    renderFinance();
    fireEvent.click(screen.getByRole("button", { name: "Expenses" }));
    fireEvent.click(await screen.findByRole("button", { name: "Add expense" }));
    const modal = await screen.findByTestId("add-expense");
    fireEvent.change(within(modal).getByLabelText("Payee"), { target: { value: "Bonhams" } });
    fireEvent.change(within(modal).getByLabelText("Amount"), { target: { value: "1800.00" } });
    expect(within(modal).getByTestId("approval-hint")).toHaveTextContent(/Principal/); // £1,800 ≥ £1,500
    fireEvent.click(within(modal).getByRole("button", { name: "Submit expense" }));
    await waitFor(() =>
      expect(submitExpense).toHaveBeenCalledWith(expect.objectContaining({ payee: "Bonhams", amountMinor: 180000, currency: "GBP" }), "t"),
    );
  });

  it("adds a payment method and schedules a payment (never moves money)", async () => {
    renderFinance();
    fireEvent.click(screen.getByRole("button", { name: "Pay queue" }));
    // add a method
    fireEvent.click(await screen.findByRole("button", { name: "Add method" }));
    const m = await screen.findByTestId("add-method");
    fireEvent.change(within(m).getByLabelText("Method name"), { target: { value: "Amex Platinum" } });
    fireEvent.click(within(m).getByRole("button", { name: "Add method" }));
    await waitFor(() => expect(createMethod).toHaveBeenCalledWith(expect.objectContaining({ displayName: "Amex Platinum" }), "t"));
    // schedule a payment
    fireEvent.click(screen.getByRole("button", { name: "Schedule payment" }));
    const s = await screen.findByTestId("schedule-payment");
    fireEvent.change(within(s).getByLabelText("Amount"), { target: { value: "220.00" } });
    fireEvent.click(within(s).getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(schedulePayment).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 22000, mode: "manual" }), "t"));
  });

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

  it("the Reconcile tab shows auto-suggested matches with a score (F14)", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Reconcile" }));
    expect(await screen.findAllByTestId("recon-row")).toHaveLength(2);
    // the high-confidence suggestion shows its score + reasons + a confirm action
    expect(screen.getByText("100% match")).toBeInTheDocument();
    expect(screen.getByText(/amount matches exactly/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm match/ })).toBeInTheDocument();
    // the unmatchable txn shows the manual fallback
    expect(screen.getByText(/review and link a receipt manually/)).toBeInTheDocument();
  });

  it("the Receipts tab shows a receipt's brand-normalised line items (F13)", async () => {
    renderFinance();
    await screen.findByText("Recurring schedule · 2");
    fireEvent.click(screen.getByRole("button", { name: "Receipts" }));
    expect(await screen.findAllByTestId("line-row")).toHaveLength(2);
    expect(screen.getByText("Nespresso pods Arpeggio")).toBeInTheDocument();
    expect(screen.getByText("nespresso")).toBeInTheDocument();   // brand-norm
    expect(screen.getAllByText("Groceries").length).toBeGreaterThanOrEqual(1); // category
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
